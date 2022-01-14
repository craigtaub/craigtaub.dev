/**
 * Implement Gatsby's Browser APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/browser-apis/
 */
require("prismjs/themes/prism-okaidia.css")
// You can delete this file if you're not using it

if (global.window.location.pathname === '/intro') {
  window.location.replace("introducing-my-under-the-hood-of-series");
}