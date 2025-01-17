import service from "./base";

export function deploy(list, env, files) {
  return service.post("/deploy", { list, env, files });
}

// host:pasword
// 脚本
export function run(server, cmd) {
  return service.post("/run", { server, cmd });
}

export function getDeployings() {
  return service.get("/deployings", { headers: { nofeel: true } });
}

export function stopDeploy(host) {
  return service.delete(`/deploying?host=${encodeURIComponent(host)}`);
}

export function deploySSL(server, domain) {
  return service.post(
    "/deploy-ssl",
    { server, domain },
    { timeout: 10 * 60 * 1000 }
  );
}
