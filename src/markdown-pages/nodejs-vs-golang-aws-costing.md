---
path: "/nodejs-vs-golang-aws-costing"
date: "2022-09-19"
title: "NodeJS vs Golang - an AWS costing exercise"
---

When you look at the backend landscape, currently there are many popular languages - I would say Golang and Python are the most popular, with NodeJS/TypeScript towards the top of the list especially when the role requires some full-stack work.

I am not going to argue against Golang today - it is a great language with many years of hard work to build out its performance, syntax, tooling, community and many more assets.

The part I want to look at today is whether there is much value in migrating from TypeScript to Golang for <b>purely cost reasons</b>.
I want to answer what kind of savings would it offer to a company who uses many of AWS products??

We will use an example company so we have something to compare against.

### Introducing CompanyX

They have a website, native mobile apps and TV app, all powered by an API run entirely on AWS. The surve to tens of thousands of users which produces millions of requests.
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

Here you can see the % of products of the entire bill.
<img src="/images/npm/total-bill-pre-savings.png" alt="bill pre savings" width="350px">


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

That means the maximum saving from the bill is £3,150, that is 22% from the overall bill. That is pretty good it's just under a quarter. However we still need those services, they will just be run using Golang rather than NodeJS.

So now let's actually dig into what changes with those if we swap to Golang.

### What is the savings?

Here is a link to the pricing pages to review my comments below yourselves:

- EC2 on-demand [here](https://aws.amazon.com/ec2/pricing/on-demand/).
- Fargate [here](https://aws.amazon.com/fargate/pricing/).
- Lambda [here](https://aws.amazon.com/lambda/pricing/).

### EC2

We are paying per "on-demand instance hour", which means we pay for the compute capacity we used from the time the instance launched until it was terminated or stopped.

Let us assume Golang is twice as fast as NodeJS - many different benchmarks do support a similar theory.

Of the £2k bill £1.5k is the "on-demand per instance hour" (the rest is related to NatGateway), so that is brought down to £750. So the total EC2 bill is £1,250. Down from £2k.

### Fargate

Fargate pricing is very similar to EC2 on-demand model, in that we pay for the resources used from time the pod starts until it's terminated. It applies for memory, cpu and storage all per hour.

Of the £1000 bill £800 is for the hourly vCPU charges.

Similar to above we assume Golang to be twice as fast, we reduce £800 to £400 bringing the overall Fargate bill to £600.

### Lambda

The last application type is a serverless lambda. With lambdas we typically pay for:

- Invoke numbers
- Duration

In general it seems duration costs are higher than invoke numbers.

CompanyX currently only pays £160, £140 of which is for compute time, the other £20 is for request count.

We will need the same number of invoke numbers, as the same number of clients will be requesting data, but the latency is lower.
So by speeding up our compute time we can possibly halve the cost to £70. Bringing the total for Lambda to £90 a month.

### The savings

Above produces to following savings:

- EC2 - £750
- Fargate - £400
- Lambda - £70

That is a total saving of £1,220. That is 8% from our overall total bill of £13,920.

After applying the saving, here you can see the % of products of the entire bill.
<img src="/images/npm/total-bill-post-savings.png" alt="bill post savings" width="350px">

### Overall

So that's it - for CompanyX they will save £1,220 a month - which will bring their yearly bill down from £167,040 to £152,400. So £15,000 they can spend on something else.

From my experience to most companies, including startups, £15,000 is pretty small.

Considering the amount of developer time and effort which will have to be invested in order to learn and implement Golang, it does not seem worth it <b>purely</b> for cost reasons. However as I said at the start, if the reasons are more than cost than it definitely can reap long-term benefits.

Please do remember this is just a numbers exercise, but I have tried to base it on a real scenario.

Thanks for reading my article - I hope you found it useful.
