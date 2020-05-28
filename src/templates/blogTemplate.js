import React from "react"
import { graphql } from "gatsby"
import Layout from "../components/layout"
import SEO from "../components/seo"
export default function Template({
  data, // this prop will be injected by the GraphQL query below.
}) {
  const { markdownRemark } = data // data.markdownRemark holds your post data
  const { frontmatter, html } = markdownRemark
  return (
    <Layout>
      <SEO title={frontmatter.title} />
      <div className="blog-post-container">
        <div className="blog-post">
          <h1
            style={{
              fontFamily: "Comfortaa, cursive",
              color: "rebeccapurple",
            }}
          >
            {frontmatter.title}
          </h1>
          <h2
            style={{
              fontFamily: "Comfortaa, cursive",
              color: "rebeccapurple",
            }}
          >
            {frontmatter.date}
          </h2>
          <div
            className="blog-post-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </Layout>
  )
}
export const pageQuery = graphql`
  query($path: String!) {
    markdownRemark(frontmatter: { path: { eq: $path } }) {
      html
      frontmatter {
        date(formatString: "MMMM DD, YYYY")
        path
        title
      }
    }
  }
`
