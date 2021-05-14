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
    <div className="header-text">
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
      <section className="header-links">
        <Link to="/subscribe">Subscribe</Link>
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
