global.fetchMPWasm = function fetchMPWasm(source) {
  const { importObj, errNoObj } = require("./setup");
  const memory = importObj.env.memory;

  return WebAssembly.instantiateStreaming(fetch(source), importObj).then(
    obj => {
      const wasmInstance = obj.instance;
      errNoObj.getLoc = wasmInstance.exports.___errno_location;

      const memUtils = require("./mem-utils")(memory, wasmInstance);
      const mpf = require("./mpf")(wasmInstance, memUtils);

      return { mpf };
    }
  );
};
