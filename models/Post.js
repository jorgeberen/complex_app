const postsCollection = require("../db").db().collection("posts")
const followsCollection = require("../db").db().collection("follows")
const ObjectID = require("mongodb").ObjectID
const User = require("./User")
const sanitizeHTML = require("sanitize-html")
const fetch = require("node-fetch")

let Post = function (data, userid, requestedPostId) {
  this.data = data
  this.errors = []
  this.userid = userid
  this.requestedPostId = requestedPostId
}

Post.prototype.getWeather = async function (city) {
  if (!this.weather_data_promise) {
    console.log(typeof city)
    let url1 = "api.openweathermap.org/data/2.5/weather?q="
    let url2 = city
    let url3 = "&appid=76551504e085b618204b4ad2e4e6f04d"
    console.log(url1 + url2 + url3)

    let fetch_weather = fetch(url1 + url2 + url3)

    // let fetch_weather = await fetch(
    //   "https://api.openweathermap.org/data/2.5/weather?id=6359002&appid=76551504e085b618204b4ad2e4e6f04d"
    // )

    this.weather_data_promise = await fetch_weather.json() // cache the Promise
  }

  let weather_data = await this.weather_data_promise
  return weather_data.main
}

Post.prototype.cleanUp = async function () {
  if (typeof this.data.title != "string") {
    this.data.title = ""
  }
  if (typeof this.data.body != "string") {
    this.data.body = ""
  }

  return this.getWeather(this.data.location).then((weather_data) => {
    return {
      title: sanitizeHTML(this.data.title.trim(), {
        allowedTags: [],
        allowedAttributes: [],
      }),
      body: sanitizeHTML(this.data.body.trim(), {
        allowedTags: [],
        allowedAttributes: [],
      }),
      createdDate: new Date(),
      author: ObjectID(this.userid),
      location: sanitizeHTML(this.data.location.trim()),
      temp: weather_data.temp,
    }
  })

  //Get rid of any bogus properties
}

Post.prototype.validate = function (data) {
  let errors = []
  if (data.title === "") {
    errors.push("You must provide a title.")
  }
  if (data.body === "") {
    errors.push("You must post content.")
  }
  return errors
}

Post.prototype.create = function () {
  // console.log(this)
  return this.cleanUp()
    .then((data) => {
      console.log(data)
      let errors = this.validate(data)
      if (errors.length === 0) {
        //Save post into database if there are no errors
        return postsCollection.insertOne(data).then((info) => {
          console.log(info.ops[0]._id)
          return info.ops[0]._id //This promise resolves with the id of the post created so that it can be used by the controller to redirect to the newly created post upon saving it
        })
        // .catch(() => {
        //   this.errors.push("Please try again later")
        //   reject(this.errors)
        // })
      } else {
        throw new Error(errors.join("|"))
      }
    })
    .catch((error) => {
      // this.errors.push("Please try again later.")
      console.log(error)
    })
}

Post.prototype.update = function () {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(this.requestedPostId, this.userid)
      if (post.isVisitorOwner) {
        // actually update the DB
        let status = await this.actuallyUpdate()
        resolve(status)
      } else {
        reject()
      }
    } catch {
      reject()
    }
  })
}

Post.prototype.actuallyUpdate = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    this.validate()
    if (!this.errors.length) {
      await postsCollection.findOneAndUpdate(
        { _id: new ObjectID(this.requestedPostId) },
        { $set: { title: this.data.title, body: this.data.body } }
      )
      resolve("success")
    } else {
      resolve("failure")
    }
  })
}

Post.reusablePostQuery = function (uniqueOperations, visitorId) {
  return new Promise(async function (resolve, reject) {
    let aggOperations = uniqueOperations.concat([
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "authorDocument",
        },
      },
      {
        $project: {
          title: 1,
          body: 1,
          createdDate: 1,
          location: 1,
          authorId: "$author",
          author: { $arrayElemAt: ["$authorDocument", 0] },
        },
      },
    ])

    let posts = await postsCollection.aggregate(aggOperations).toArray()

    //Clean up author property in each post object
    posts = posts.map(function (post) {
      post.isVisitorOwner = post.authorId.equals(visitorId) //equals is a mongodb method
      post.authorId = undefined
      post.author = {
        username: post.author.username,
        avatar: new User(post.author, true).avatar,
      }
      post.location = post.location
      // post.weather = post.weather
      return post
    })

    resolve(posts)
  })
}

Post.findSingleById = function (id, visitorId) {
  return new Promise(async function (resolve, reject) {
    if (typeof id != "string" || !ObjectID.isValid(id)) {
      reject()
      return
    }

    let posts = await Post.reusablePostQuery(
      [{ $match: { _id: new ObjectID(id) } }],
      visitorId
    )

    if (posts.length) {
      resolve(posts[0])
    } else {
      reject()
    }
  })
}

Post.findByAuthorId = function (authorId) {
  return Post.reusablePostQuery([
    { $match: { author: authorId } },
    { $sort: { createdDate: -1 } },
  ])
}

Post.delete = function (postIdToDelete, currentUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(postIdToDelete, currentUserId)
      if (post.isVisitorOwner) {
        await postsCollection.deleteOne({ _id: new ObjectID(postIdToDelete) })
        resolve()
      } else {
        reject()
      }
    } catch {
      reject()
    }
  })
}

Post.search = function (searchTerm) {
  return new Promise(async (resolve, reject) => {
    if (typeof searchTerm == "string") {
      let posts = await Post.reusablePostQuery([
        { $match: { $text: { $search: searchTerm } } },
        { $sort: { score: { $meta: "textScore" } } },
      ])
      resolve(posts)
    } else {
      reject()
    }
  })
}

Post.countPostsByAuthor = function (id) {
  return new Promise(async (resolve, reject) => {
    let postCount = await postsCollection.countDocuments({ author: id })
    resolve(postCount)
  })
}

Post.getFeed = async function (id) {
  // Create an array of the user Ids that the current user follows
  let followedUsers = await followsCollection
    .find({ authorId: new ObjectID(id) })
    .toArray()
  followedUsers = followedUsers.map(function (followDoc) {
    return followDoc.followedId
  })
  // Look for posts where the author is in the above array of followed users
  return Post.reusablePostQuery([
    { $match: { author: { $in: followedUsers } } },
    { $sort: { createdDate: -1 } },
  ])
}

// Post.prototype.consumeWeather = async function () {
//   try {
//     let weather_data = await Post.getWeather()
//     let temp = weather_data.temp
//     console.log("Consume Data", temp)
//     // do something with `temp`
//     console.log(this)
//     return (this.data.temp = temp)
//   } catch (error) {
//     // something went wrong
//   }
// }

module.exports = Post

// fetch(
//   "https://api.openweathermap.org/data/2.5/weather?id=6359002&appid=76551504e085b618204b4ad2e4e6f04d"
// )
//   .then((response) => response.json())
//   .then((data) => {
//     console.log(data.main.temp)
//     return (temp = data.main.temp)
//   })
// return new Promise(async (resolve, reject) => {
//   let fetch_weather = await fetch(
//     "https://api.openweathermap.org/data/2.5/weather?id=6359002&appid=76551504e085b618204b4ad2e4e6f04d"
//   )

//   let weather_json = await fetch_weather.json()
//   console.log(weather_json.main.temp)
//   resolve((temp = weather_json.main.temp))
// })

// Thanks for your answer. It's been helpful but I am still don't know how to do what I want. Ultimately I want to store the `temperature` value in the Post constructor, as a property of the object so that I can store it in the DB. How would I call the function then? Would I simply do `this.letsConsumeAsynchronouslyDerivedWeatherData()`? I have updated the original question with additional code and what I have tried.
