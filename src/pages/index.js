import React from "react"
import { graphql, Link } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"
import PostLink from "../components/post-link"

const IndexPage = ({
  data: {
    allMarkdownRemark: { edges },
  },
}) => {
  // if no "date" DO NOT render article
  const Posts = edges
    .filter(edge => !!edge.node.frontmatter.date)
    .map(edge => <PostLink key={edge.node.id} post={edge.node} />)

  return (
    <Layout>
      <SEO title="Craig Taub's blog" />
      <div>
        My name is Craig Taub, this is my blog
        <br />
        <img
          width="200px"
          height="200px"
          src="http://craigtaub.dev/images/me.png"
          style={{ float: "right", padding: "20px" }}
        />
        <br /> I am a software engineer living in London. I post mainly about{" "}
        <b>JavaScript</b> and <b>NodeJS</b> but also occasionally about
        performance, testing, databases, dev-ops and best-practices. <br />
        Also was on the MochaJS core team for over 3 years, testing and
        open-source is something I care deeply about. Lastly I am a big football
        fan and support QPR.
        <br />
        <br />I hope you enjoy my blog.
        <br />
        <br />
        <h2 style={{ fontFamily: "Comfortaa, cursive" }}>On the web</h2>
        <ul>
          <li>
            Email :{" "}
            <a target="_blank" href="mailto:craigtaub@gmail.com">
              craigtaub@gmail.com
            </a>
          </li>
          <li>
            Twitter :{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://twitter.com/craigtaub"
            >
              @craigtaub
            </a>
          </li>
          <li>
            Github :{" "}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/craigtaub"
            >
              craigtaub
            </a>
          </li>
          <li>
            <Link to="/subscribe">Subscribe to my blog</Link>
          </li>
        </ul>
        <br />
      </div>
      <div>{Posts}</div>
    </Layout>
  )
}

export default IndexPage

export const pageQuery = graphql`
  query {
    allMarkdownRemark(sort: { order: DESC, fields: [frontmatter___date] }) {
      edges {
        node {
          id
          excerpt(pruneLength: 250)
          frontmatter {
            date(formatString: "MMMM DD, YYYY")
            path
            title
          }
        }
      }
    }
  }
`
