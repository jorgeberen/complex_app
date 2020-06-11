const User = require('../models/User')
const Post = require('../models/Post')

exports.mustBeLoggedIn = function (req, res, next) {
  if (req.session.user) {
    next()
  } else {
    req.flash('errors', 'You must be logged in to do that.')
    req.session.save(function () {
      res.redirect('/')
    })
  }
}

exports.login = function (req, res) {
  let user = new User(req.body)

  user
    .login()
    .then(function (result) {
      req.session.user = {
        avatar: user.avatar,
        username: user.data.username,
        _id: user.data._id,
      }
      req.session.save(function () {
        res.redirect('/')
      })
    })
    .catch(function (e) {
      req.flash('errors', e)
      req.session.save(function () {
        //Callback function to make sure that redirect doesn't happen before the flash message
        res.redirect('/')
      })
    })
}

exports.logout = function (req, res) {
  req.session.destroy(function () {
    res.redirect('/')
  })
}

exports.register = function (req, res) {
  let user = new User(req.body) //It creates a new object using User as a blueprint. It creates a new instance. Capitalise your constructors.
  user
    .register()
    .then(() => {
      req.session.user = {
        username: user.data.username,
        avatar: user.avatar,
        _id: user.data._id,
      }
      req.session.save(function () {
        res.redirect('/')
      })
    })
    .catch((regErrors) => {
      regErrors.forEach(function (error) {
        req.flash('regErrors', error)
      })
      req.session.save(function () {
        res.redirect('/')
      })
    })
}

exports.home = function (req, res) {
  if (req.session.user) {
    res.render('home-dashboard')
  } else {
    res.render('home-guest', {
      regErrors: req.flash('regErrors'),
    })
  }
}

exports.ifUserExists = function (req, res, next) {
  User.findByUsername(req.params.username)
    .then(function (userDocument) {
      req.profileUser = userDocument //We create profileUser property in the request object so that profilePostScreen can use it
      next()
    })
    .catch(function () {
      res.render('404-html')
    })
}

exports.profilePostsScreen = function (req, res) {
  //Ask our post model for posts by a certain author id

  Post.findByAuthorId(req.profileUser._id)
    .then(function (posts) {
      res.render('profile', {
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
      })
    })
    .catch(function () {
      res.render('404-html')
    })
}