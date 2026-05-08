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

eval("/*!\n * normalize-path <https://github.com/jonschlinkert/normalize-path>\n *\n * Copyright (c) 2014-2018, Jon Schlinkert.\n * Released under the MIT License.\n */\n\nmodule.exports = function(path, stripTrailing) {\n  if (typeof path !== 'string') {\n    throw new TypeError('expected path to be a string');\n  }\n\n  if (path === '\\\\' || path === '/') return '/';\n\n  var len = path.length;\n  if (len <= 1) return path;\n\n  // ensure that win32 namespaces has two leading slashes, so that the path is\n  // handled properly by the win32 version of path.parse() after being normalized\n  // https://msdn.microsoft.com/library/windows/desktop/aa365247(v=vs.85).aspx#namespaces\n  var prefix = '';\n  if (len > 4 && path[3] === '\\\\') {\n    var ch = path[2];\n    if ((ch === '?' || ch === '.') && path.slice(0, 2) === '\\\\\\\\') {\n      path = path.slice(2);\n      prefix = '//';\n    }\n  }\n\n  var segs = path.split(/[/\\\\]+/);\n  if (stripTrailing !== false && segs[segs.length - 1] === '') {\n    segs.pop();\n  }\n  return prefix + segs.join('/');\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbm9ybWFsaXplLXBhdGgvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIkM6XFxDaHJpc3QgSUNGXFxzb2Npb3dlYlxcY2xpZW50XFxub2RlX21vZHVsZXNcXG5vcm1hbGl6ZS1wYXRoXFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAqIG5vcm1hbGl6ZS1wYXRoIDxodHRwczovL2dpdGh1Yi5jb20vam9uc2NobGlua2VydC9ub3JtYWxpemUtcGF0aD5cbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtMjAxOCwgSm9uIFNjaGxpbmtlcnQuXG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXRoLCBzdHJpcFRyYWlsaW5nKSB7XG4gIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdleHBlY3RlZCBwYXRoIHRvIGJlIGEgc3RyaW5nJyk7XG4gIH1cblxuICBpZiAocGF0aCA9PT0gJ1xcXFwnIHx8IHBhdGggPT09ICcvJykgcmV0dXJuICcvJztcblxuICB2YXIgbGVuID0gcGF0aC5sZW5ndGg7XG4gIGlmIChsZW4gPD0gMSkgcmV0dXJuIHBhdGg7XG5cbiAgLy8gZW5zdXJlIHRoYXQgd2luMzIgbmFtZXNwYWNlcyBoYXMgdHdvIGxlYWRpbmcgc2xhc2hlcywgc28gdGhhdCB0aGUgcGF0aCBpc1xuICAvLyBoYW5kbGVkIHByb3Blcmx5IGJ5IHRoZSB3aW4zMiB2ZXJzaW9uIG9mIHBhdGgucGFyc2UoKSBhZnRlciBiZWluZyBub3JtYWxpemVkXG4gIC8vIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2xpYnJhcnkvd2luZG93cy9kZXNrdG9wL2FhMzY1MjQ3KHY9dnMuODUpLmFzcHgjbmFtZXNwYWNlc1xuICB2YXIgcHJlZml4ID0gJyc7XG4gIGlmIChsZW4gPiA0ICYmIHBhdGhbM10gPT09ICdcXFxcJykge1xuICAgIHZhciBjaCA9IHBhdGhbMl07XG4gICAgaWYgKChjaCA9PT0gJz8nIHx8IGNoID09PSAnLicpICYmIHBhdGguc2xpY2UoMCwgMikgPT09ICdcXFxcXFxcXCcpIHtcbiAgICAgIHBhdGggPSBwYXRoLnNsaWNlKDIpO1xuICAgICAgcHJlZml4ID0gJy8vJztcbiAgICB9XG4gIH1cblxuICB2YXIgc2VncyA9IHBhdGguc3BsaXQoL1svXFxcXF0rLyk7XG4gIGlmIChzdHJpcFRyYWlsaW5nICE9PSBmYWxzZSAmJiBzZWdzW3NlZ3MubGVuZ3RoIC0gMV0gPT09ICcnKSB7XG4gICAgc2Vncy5wb3AoKTtcbiAgfVxuICByZXR1cm4gcHJlZml4ICsgc2Vncy5qb2luKCcvJyk7XG59O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/normalize-path/index.js\n");

/***/ })

};
;