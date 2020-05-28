import { Link } from "gatsby"
import PropTypes from "prop-types"
import React from "react"

const Header = ({ siteTitle }) => (
  <header
    style={{
      background: `rebeccapurple`,
      marginBottom: `1.45rem`,
    }}
  >
    <div class="header-text">
      <h1
        style={{
          margin: 0,
          fontFamily: "Comfortaa, cursive",
          fontSize: "43.2px",
          flex: 1,
          minWidth: "270px",
        }}
      >
        <Link
          to="/"
          style={{
            color: `white`,
            textDecoration: `none`,
          }}
        >
          {siteTitle}
        </Link>
      </h1>
      <section class="header-links">
        <a target="_blank" href="https://medium.com/@tabu_craig">
          Medium
        </a>
        &nbsp;|&nbsp;
        <a target="_blank" href="https://github.com/craigtaub">
          GitHub
        </a>
        &nbsp;|&nbsp;
        <a target="_blank" href="https://twitter.com/craigtaub">
          Twitter
        </a>
      </section>
    </div>
  </header>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
}

Header.defaultProps = {
  siteTitle: ``,
}

export default Header
