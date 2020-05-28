import React from "react"
import { Link } from "gatsby"
const PostLink = ({ post }) => (
  <div>
    <h2
      style={{
        fontFamily: "Comfortaa, cursive",
        color: "rebeccapurple",
      }}
    >
      <Link
        to={post.frontmatter.path}
        style={{ textDecoration: "none", color: "rebeccapurple" }}
      >
        {" "}
        {post.frontmatter.title}
        <br />
        <span style={{ fontSize: "18px" }}>{post.frontmatter.date}</span>
      </Link>
    </h2>
    <p>{post.excerpt}</p>
  </div>
)
export default PostLink
