"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/listenercount";
exports.ids = ["vendor-chunks/listenercount"];
exports.modules = {

/***/ "(ssr)/./node_modules/listenercount/index.js":
/*!*********************************************!*\
  !*** ./node_modules/listenercount/index.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar listenerCount = (__webpack_require__(/*! events */ \"events\").listenerCount)\n// listenerCount isn't in node 0.10, so here's a basic polyfill\nlistenerCount = listenerCount || function (ee, event) {\n  var listeners = ee && ee._events && ee._events[event]\n  if (Array.isArray(listeners)) {\n    return listeners.length\n  } else if (typeof listeners === 'function') {\n    return 1\n  } else {\n    return 0\n  }\n}\n\nmodule.exports = listenerCount\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbGlzdGVuZXJjb3VudC9pbmRleC5qcyIsIm1hcHBpbmdzIjoiQUFBWTs7QUFFWixvQkFBb0IsMkRBQStCO0FBQ25EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBOztBQUVBIiwic291cmNlcyI6WyJEOlxcQ09ERVNcXFNPQ0lPXFxzb2Npb3dlYlxcY2xpZW50XFxub2RlX21vZHVsZXNcXGxpc3RlbmVyY291bnRcXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0J1xuXG52YXIgbGlzdGVuZXJDb3VudCA9IHJlcXVpcmUoJ2V2ZW50cycpLmxpc3RlbmVyQ291bnRcbi8vIGxpc3RlbmVyQ291bnQgaXNuJ3QgaW4gbm9kZSAwLjEwLCBzbyBoZXJlJ3MgYSBiYXNpYyBwb2x5ZmlsbFxubGlzdGVuZXJDb3VudCA9IGxpc3RlbmVyQ291bnQgfHwgZnVuY3Rpb24gKGVlLCBldmVudCkge1xuICB2YXIgbGlzdGVuZXJzID0gZWUgJiYgZWUuX2V2ZW50cyAmJiBlZS5fZXZlbnRzW2V2ZW50XVxuICBpZiAoQXJyYXkuaXNBcnJheShsaXN0ZW5lcnMpKSB7XG4gICAgcmV0dXJuIGxpc3RlbmVycy5sZW5ndGhcbiAgfSBlbHNlIGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIDFcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gMFxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdGVuZXJDb3VudFxuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/listenercount/index.js\n");

/***/ })

};
;