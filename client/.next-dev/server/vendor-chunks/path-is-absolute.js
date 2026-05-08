"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/path-is-absolute";
exports.ids = ["vendor-chunks/path-is-absolute"];
exports.modules = {

/***/ "(ssr)/./node_modules/path-is-absolute/index.js":
/*!************************************************!*\
  !*** ./node_modules/path-is-absolute/index.js ***!
  \************************************************/
/***/ ((module) => {

eval("\n\nfunction posix(path) {\n\treturn path.charAt(0) === '/';\n}\n\nfunction win32(path) {\n\t// https://github.com/nodejs/node/blob/b3fcc245fb25539909ef1d5eaa01dbf92e168633/lib/path.js#L56\n\tvar splitDeviceRe = /^([a-zA-Z]:|[\\\\\\/]{2}[^\\\\\\/]+[\\\\\\/]+[^\\\\\\/]+)?([\\\\\\/])?([\\s\\S]*?)$/;\n\tvar result = splitDeviceRe.exec(path);\n\tvar device = result[1] || '';\n\tvar isUnc = Boolean(device && device.charAt(1) !== ':');\n\n\t// UNC paths are always absolute\n\treturn Boolean(result[2] || isUnc);\n}\n\nmodule.exports = process.platform === 'win32' ? win32 : posix;\nmodule.exports.posix = posix;\nmodule.exports.win32 = win32;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvcGF0aC1pcy1hYnNvbHV0ZS9pbmRleC5qcyIsIm1hcHBpbmdzIjoiQUFBYTs7QUFFYjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLHlDQUF5QyxFQUFFO0FBQzNDO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxvQkFBb0I7QUFDcEIsb0JBQW9CIiwic291cmNlcyI6WyJDOlxcQ2hyaXN0IElDRlxcc29jaW93ZWJcXGNsaWVudFxcbm9kZV9tb2R1bGVzXFxwYXRoLWlzLWFic29sdXRlXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHBvc2l4KHBhdGgpIHtcblx0cmV0dXJuIHBhdGguY2hhckF0KDApID09PSAnLyc7XG59XG5cbmZ1bmN0aW9uIHdpbjMyKHBhdGgpIHtcblx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvYjNmY2MyNDVmYjI1NTM5OTA5ZWYxZDVlYWEwMWRiZjkyZTE2ODYzMy9saWIvcGF0aC5qcyNMNTZcblx0dmFyIHNwbGl0RGV2aWNlUmUgPSAvXihbYS16QS1aXTp8W1xcXFxcXC9dezJ9W15cXFxcXFwvXStbXFxcXFxcL10rW15cXFxcXFwvXSspPyhbXFxcXFxcL10pPyhbXFxzXFxTXSo/KSQvO1xuXHR2YXIgcmVzdWx0ID0gc3BsaXREZXZpY2VSZS5leGVjKHBhdGgpO1xuXHR2YXIgZGV2aWNlID0gcmVzdWx0WzFdIHx8ICcnO1xuXHR2YXIgaXNVbmMgPSBCb29sZWFuKGRldmljZSAmJiBkZXZpY2UuY2hhckF0KDEpICE9PSAnOicpO1xuXG5cdC8vIFVOQyBwYXRocyBhcmUgYWx3YXlzIGFic29sdXRlXG5cdHJldHVybiBCb29sZWFuKHJlc3VsdFsyXSB8fCBpc1VuYyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IHdpbjMyIDogcG9zaXg7XG5tb2R1bGUuZXhwb3J0cy5wb3NpeCA9IHBvc2l4O1xubW9kdWxlLmV4cG9ydHMud2luMzIgPSB3aW4zMjtcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/path-is-absolute/index.js\n");

/***/ })

};
;