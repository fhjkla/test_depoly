const { Controller } = require("egg");
const dayjs = require("dayjs");
const cert = require("../service/cert");
const utils = require("../service/utils");
var multer = require("multer");
const { log, error } = require("console");
const { isObjectEqual } = require("../service/record");
const fs = require("fs");
const path = require("path");
const config = require("../service/config");
const pump = require('mz-modules/pump');

const userFile = config.userFile();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, req.context.fileDir); // 上传文件的存储路径
  },
  filename: function (req, file, cb) {
    const now = dayjs();
    const time = now.format("YYYYMMDD-HH:mm:ss");
    cb(null, `${time}~${file.originalname}`); // 上传文件的文件名
  },
});
const upload = multer({
  storage: storage,
});
const util = require("util");

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
// 初始化环境
const workspaceDir = path.resolve(__dirname, "../../workspace");
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir);
}
class DeployController extends Controller {
  queryFileStat(filePath) {
    return new Promise((rs, rj) => {
      fs.stat(filePath, (err, stat) => {
        if (err) {
          return rs(`err:${err.code}`);
        }
        rs(`${(stat.size / 1000000).toFixed(3)}M(${stat.size})`);
      });
    });
  }
  // 获取变量
  async getVars(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const data = await readFile(req.context.varsFile, "utf-8");
      ctx.body = { data: data };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 更新配置
  async updateVars(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const data = await writeFile(
        req.context.varsFile,
        req.body.data,
        "utf-8"
      );
      ctx.body = { data: data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取文件列表
  async getFiles(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const files = await readdir(req.context.fileDir);
      ctx.body = { data: files.map((file) => ({ file })) };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 获取文件列表及文件大小
  async getFilesStat(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const files = await readdir(req.context.fileDir);
      const stats = await Promise.all(
        files.map((file) =>
          this.queryFileStat(path.resolve(req.context.fileDir, file))
        )
      );
      ctx.body = {
        data: files.map((file, index) => ({ file, size: stats[index] })),
      };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 文件上传
  async uploadFile(ctx) {
    const stream = await ctx.getFileStream();
    const { request: req, response: res } = ctx;
    const time = dayjs().format("YYYYMMDD-HH:mm:ss");
    // 生成目标文件路径
    const targetPath = path.resolve(
      req.context.fileDir,
      `${time}~${path.basename(stream.filename)}`
    );
    // 确保目标目录存在
    await fs.promises.mkdir(req.context.fileDir, { recursive: true });
    // 创建写流
    const writeStream = fs.createWriteStream(targetPath);
    // 使用 pump 将文件流传输到写流
    await pump(stream, writeStream);
    ctx.body = { data: "success" };
  }

  // 获取服务器列表
  async deleteFile(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const filePath = path.resolve(req.context.fileDir, name);

    try {
      const data = await unlink(filePath);
      ctx.body = { data: data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // {服务器名字:'host,password'}
  // 获取服务器列表
  async getHosts(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const data = await readFile(req.context.hostsFile, "utf-8");
      let jsonData = "";
      try {
        jsonData = JSON.parse(data);
      } catch (error) {}

      ctx.body = { data: jsonData };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取服务器列表
  async postHosts(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const data = await writeFile(
        req.context.hostsFile,
        JSON.stringify(req.body.data, null, 2),
        "utf-8"
      );
      ctx.body = { data: "success" };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 获取配置列表
  async getConfigs(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;

    try {
      const files = await readdir(context.configDir);
      ctx.body = { data: files.map((name) => ({ name })) };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取配置
  async getConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      ctx.body = { data: data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 上传配置
  async postConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);

    try {
      await writeFile(filePath, req.body.data, "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除配置
  async deleteConfig(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.configDir, name);

    try {
      await unlink(filePath);
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 获取脚本列表
  async getScripts(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;

    try {
      const files = await readdir(context.scriptDir);
      ctx.body = { data: files.map((name) => ({ name })) };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取脚本
  async getScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      ctx.body = { data: data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 更新脚本
  async postScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);

    try {
      await writeFile(filePath, req.body.data, "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除脚本
  async deleteScript(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.scriptDir, name);

    try {
      await unlink(filePath);
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 获取编排列表
  async getBats(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const files = await readdir(req.context.batDir);
      ctx.body = { data: files.map((name) => ({ name })) };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取编排
  async getbat(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const filePath = path.resolve(req.context.batDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      ctx.body = {
        data: data ? JSON.parse(data) : `编排组合[${name}]未找到`,
      };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 新增编排
  async postBat(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);
    const exist = fs.existsSync(filePath);
    if (exist) {
      return (ctx.body = { err: "编排已存在" });
    }

    try {
      const data = await writeFile(filePath, "{}", "utf-8");
      ctx.body = { data: data };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除编排
  async deleteBat(ctx) {
    const { request: req, response: res } = ctx;
    const context = req.context;
    const name = req.query.name;
    const filePath = path.resolve(context.batDir, name);

    try {
      await unlink(filePath);
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 更新编排
  async postBatItem(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.body.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      const json = JSON.parse(data);
      const { name, ...rest } = req.body.data;
      json[name] = rest;

      writeFile(filePath, JSON.stringify(json), "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 删除部署
  async deleteBatItem(ctx) {
    const { request: req, response: res } = ctx;
    const name = req.query.name;
    const context = req.context;
    const filePath = path.resolve(context.batDir, name);

    try {
      const data = await readFile(filePath, "utf-8");
      const json = JSON.parse(data);
      delete json[req.query.item];

      writeFile(filePath, JSON.stringify(json), "utf-8");
      ctx.body = { success: true };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 获取脚本列表
  async getDeploys(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const files = await readdir(req.context.deployDir);
      ctx.body = { data: files };
    } catch (err) {
      ctx.body = { err };
    }
  }

  // 部署
  async postDeploy(ctx) {
    const { request: req, response: res } = ctx;
    // [{name:string,host:string,cmds:string[]}]
    let list = req.body.list;
    const env = req.body.env;
    const recordList = list;
    if (!list || !list.length) {
      return (ctx.body = { err: "请选择部署的脚本" });
    }
    const vars = utils.parseVars.call(req.context);
    const hosts = utils.parseHosts.call(req.context);
    const context = Object.assign(
      { vars, hosts, files: req.body.files },
      req.context
    );
    list = ctx.service.executer.parse(env, context, list);
    const parseErrs = list.filter((item) => item.err);
    if (parseErrs.length) {
      return (ctx.body = {
        err: parseErrs.map((item) => item.err).join(","),
      });
    }
    // 记录部署记录
    // fs.writeFile(
    //   path.resolve(
    //     req.context.deployDir,
    //     `${dayjs().format("YYYYMMDD-HH:mm:ss")}.txt`
    //   ),
    //   JSON.stringify(list, null, 2),
    //   "utf-8",
    //   () => {}
    // );
    const user = await ctx.model.Record.create(recordList);
    try {
      ctx.service.executer.deployList(list);
      ctx.body = { data: user };
    } catch (err) {
      ctx.body = { err };
    }
  }
  async postRun(ctx) {
    const { request: req, response: res } = ctx;
    const hosts = utils.parseHosts.call(req.context);
    const server = hosts[req.body.server];
    if (!server) {
      return (ctx.body = { err: `找不到服务器:${req.body.server}` });
    }
    await ctx.service.executer
      .run(server, req.body.cmd)
      .then(() => {
        ctx.body = { data: "success" };
      })
      .catch((err) => {
        ctx.body = { err };
      });
  }

  // 获取正在部署的
  async getDeployings(ctx) {
    ctx.body = { data: ctx.service.executer.getDeployings() };
  }

  // 获取部署
  async deleteDeploying(ctx) {
    const { request: req, response: res } = ctx;
    const host = req.query.host;
    ctx.service.executer.stopDeploy(host);
    ctx.body = { data: "sccess" };
  }

  // 申请证书
  async postDeploySsl(ctx) {
    const { request: req, response: res } = ctx;
    const domain = req.body.domain;
    const hosts = utils.parseHosts.call(req.context);
    const server = hosts[req.body.server];
    if (!server) {
      return (ctx.body = { err: `找不到服务器:${req.body.server}` });
    }
    await cert
      .requestCertificate(server, domain, ctx)
      .then(() => {
        ctx.body = { data: "sccess" };
      })
      .catch((err) => {
        ctx.body = { err };
      });
  }

  async getApiAuto(ctx) {
    const { request: req, response: res } = ctx;
    // apiAuto.init(req.query.host);
    try {
      const ApiTester = require("../api_test/index");
      global.isTest = false;
      new ApiTester({
        host: `${req.query.host}:${req.query.port}`,
        prefix: `${req.query.prefix}`,
      }).run();
      ctx.body = { data: "sccess" };
    } catch (error) {
      ctx.body = { error };
    }
  }

  // 注册
  async postRegister(ctx) {
    const { request: req, response: res } = ctx;
    const jsonData = await ctx.model.User.find({
      username: req.body.username,
    });
    if (jsonData.length > 0) {
      return (ctx.body = { err: { code: "用户名已注册" } });
    }
    try {
      await ctx.model.User.create({
        username: req.body.username,
        password: req.body.password,
      });
      ctx.body = { data: "sccess" };
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 登陆
  async postLogin(ctx) {
    const { request: req, response: res } = ctx;

    try {
      const users = await ctx.model.User.find({
        username: req.body.username,
        password: req.body.password,
      });
      if (users.length > 0) {
        ctx.body = { data: req.body.username };
      } else {
        ctx.body = { err: { code: "用户名或密码错误" } };
      }
    } catch (err) {
      ctx.body = { err };
    }
  }
  // 记录列表
  async getRecordList(ctx) {
    const { request: req, response: res } = ctx;
    try {
      const records = await ctx.model.Record.find();
      ctx.body = { data: records };
    } catch (err) {
      ctx.body = { data: "暂无记录" };
    }
  }
  //删除记录数据
  async postRecordDelete(ctx) {
    const { request: req, response: res } = ctx;
    const result = await ctx.model.Record.deleteOne(req.body.item);
    if (result.deletedCount === 1) {
      ctx.body = { data: "success" };
    } else {
      ctx.body = { err: { code: "删除失败" } };
    }
  }
}
module.exports = DeployController;
