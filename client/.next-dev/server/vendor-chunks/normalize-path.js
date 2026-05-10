/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/normalize-path";
exports.ids = ["vendor-chunks/normalize-path"];
exports.modules = {

/***/ "(ssr)/./node_modules/normalize-path/index.js":
/*!**********************************************!*\
  !*** ./node_modules/normalize-path/index.js ***!
  \**********************************************/
/***/ ((module) => {

eval("/*!\n * normalize-path <https://github.com/jonschlinkert/normalize-path>\n *\n * Copyright (c) 2014-2018, Jon Schlinkert.\n * Released under the MIT License.\n */\n\nmodule.exports = function(path, stripTrailing) {\n  if (typeof path !== 'string') {\n    throw new TypeError('expected path to be a string');\n  }\n\n  if (path === '\\\\' || path === '/') return '/';\n\n  var len = path.length;\n  if (len <= 1) return path;\n\n  // ensure that win32 namespaces has two leading slashes, so that the path is\n  // handled properly by the win32 version of path.parse() after being normalized\n  // https://msdn.microsoft.com/library/windows/desktop/aa365247(v=vs.85).aspx#namespaces\n  var prefix = '';\n  if (len > 4 && path[3] === '\\\\') {\n    var ch = path[2];\n    if ((ch === '?' || ch === '.') && path.slice(0, 2) === '\\\\\\\\') {\n      path = path.slice(2);\n      prefix = '//';\n    }\n  }\n\n  var segs = path.split(/[/\\\\]+/);\n  if (stripTrailing !== false && segs[segs.length - 1] === '') {\n    segs.pop();\n  }\n  return prefix + segs.join('/');\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbm9ybWFsaXplLXBhdGgvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIkQ6XFxDT0RFU1xcU09DSU9cXHNvY2lvd2ViXFxjbGllbnRcXG5vZGVfbW9kdWxlc1xcbm9ybWFsaXplLXBhdGhcXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIVxuICogbm9ybWFsaXplLXBhdGggPGh0dHBzOi8vZ2l0aHViLmNvbS9qb25zY2hsaW5rZXJ0L25vcm1hbGl6ZS1wYXRoPlxuICpcbiAqIENvcHlyaWdodCAoYykgMjAxNC0yMDE4LCBKb24gU2NobGlua2VydC5cbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHBhdGgsIHN0cmlwVHJhaWxpbmcpIHtcbiAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V4cGVjdGVkIHBhdGggdG8gYmUgYSBzdHJpbmcnKTtcbiAgfVxuXG4gIGlmIChwYXRoID09PSAnXFxcXCcgfHwgcGF0aCA9PT0gJy8nKSByZXR1cm4gJy8nO1xuXG4gIHZhciBsZW4gPSBwYXRoLmxlbmd0aDtcbiAgaWYgKGxlbiA8PSAxKSByZXR1cm4gcGF0aDtcblxuICAvLyBlbnN1cmUgdGhhdCB3aW4zMiBuYW1lc3BhY2VzIGhhcyB0d28gbGVhZGluZyBzbGFzaGVzLCBzbyB0aGF0IHRoZSBwYXRoIGlzXG4gIC8vIGhhbmRsZWQgcHJvcGVybHkgYnkgdGhlIHdpbjMyIHZlcnNpb24gb2YgcGF0aC5wYXJzZSgpIGFmdGVyIGJlaW5nIG5vcm1hbGl6ZWRcbiAgLy8gaHR0cHM6Ly9tc2RuLm1pY3Jvc29mdC5jb20vbGlicmFyeS93aW5kb3dzL2Rlc2t0b3AvYWEzNjUyNDcodj12cy44NSkuYXNweCNuYW1lc3BhY2VzXG4gIHZhciBwcmVmaXggPSAnJztcbiAgaWYgKGxlbiA+IDQgJiYgcGF0aFszXSA9PT0gJ1xcXFwnKSB7XG4gICAgdmFyIGNoID0gcGF0aFsyXTtcbiAgICBpZiAoKGNoID09PSAnPycgfHwgY2ggPT09ICcuJykgJiYgcGF0aC5zbGljZSgwLCAyKSA9PT0gJ1xcXFxcXFxcJykge1xuICAgICAgcGF0aCA9IHBhdGguc2xpY2UoMik7XG4gICAgICBwcmVmaXggPSAnLy8nO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzZWdzID0gcGF0aC5zcGxpdCgvWy9cXFxcXSsvKTtcbiAgaWYgKHN0cmlwVHJhaWxpbmcgIT09IGZhbHNlICYmIHNlZ3Nbc2Vncy5sZW5ndGggLSAxXSA9PT0gJycpIHtcbiAgICBzZWdzLnBvcCgpO1xuICB9XG4gIHJldHVybiBwcmVmaXggKyBzZWdzLmpvaW4oJy8nKTtcbn07XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/normalize-path/index.js\n");

/***/ })

};
;