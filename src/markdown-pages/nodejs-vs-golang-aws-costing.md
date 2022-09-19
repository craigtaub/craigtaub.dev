---
path: "/nodejs-vs-golang-aws-costing"
date: "2022-09-19"
title: "NodeJS vs Golang - an AWS costing exercise"
---

When you look at the backend landscape currently there are many popular languages - I would say Golang and Python are the most popular, with NodeJS/TypeScript towards the top of the list expecially when the role requires some full-stack work.

I am not going to argue against Golang today - it is a great langauge with many years of hard work to build out its performance, syntax, tooling, community and many more assets.

The part I want to look at today is whether there is much value is migrating from TypeScript to Golang for <b>purely cost reasons</b>.
I want to answer what kind of saving would it offer to a company who use many of AWS products??

We will use an example company so we have something to compare against.

### Introducing CompanyX

They have a website, native mobile apps and TV app, all powered by an API run entirely on AWS.
A summary of the tech stack includes

- Fargate (via ECS and EKS) - for the API
- EC2 - for the website
- Serverless Lambdas - for processing user input (which is collected very frequently) into features for different platforms as well as for storage purposes

They also use most other AWS products such as

- RDS, S3, Cloudwatch, Cloudfront, API Gateway, ElastiCache, Kinesis and more.

### CompanyX - January AWS bill

So its February and we check out the bill for the first month of the Year, the costings look like this, in order of highest price.

- RDS - £3k
- S3 - £2.5k
- Cloudwatch - £2k
- Cloudfront - £1.5k
- EC2 - £2k
- Fargate - £1k
- API Gateway - £1k
- ElastiCache - £700
- Lambda - £150
- Kinesis - £70

The total bill came to £13,920.

### What can we ignore?

So many of those services it would not matter if we were using Golang, those services are listed below

- RDS
- S3
- Cloudwatch
- Cloudfront
- API Gateway
- ElastiCache
- Kinesis

That leaves just below:

- EC2
- Fargate
- Lambda

That means the maximum saving from the bill is £3,150, that is 22% from the overall bill. That is pretty good its just under a quarter. However we still need those services, they will just be run using Golang rather than NodeJS.

So now lets actually dig into what changes with those if we swap to Golang.

### What is the saving?

### EC2

We are paying per "on-demand instance hour", which means we pay for the compute capacity we used from the time the instance launched until it was terminated or stopped.

Let us assume Golang is double as fast as NodeJS - many different benchmarks do support a similar theory.

Of the £2k bill £1.5k is the "on-demand per instance hour", so that is brough down to £750. So the total EC2 bill is £1,250. Down from £2k.

### Fargate

https://docs.google.com/document/d/1ITyiptLR7KRzEXHYuzPNibfEH1rDDjDMPiSFHx3jKD8/edit#
