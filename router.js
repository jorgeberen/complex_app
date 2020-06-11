const express = require('express')
const router = express.Router()
const userController = require('./controllers/userController')
const postController = require('./controllers/postController')

//User related routes
router.get('/', userController.home)
router.post('/register', userController.register)
router.post('/login', userController.login)
router.post('/logout', userController.logout)

//Profile related routes
router.get(
  '/profile/:username',
  userController.ifUserExists,
  userController.profilePostsScreen
)

//Post Related Routes
router.get(
  '/create-post',
  userController.mustBeLoggedIn,
  postController.viewCreateScreen
)

router.post(
  '/create-post',
  userController.mustBeLoggedIn,
  postController.create
)

router.get('/post/:id', postController.viewSingle) //We don't call mustbeloggedin because we want anyone to be able to access the posts

router.get(
  '/post/:id/edit',
  userController.mustBeLoggedIn,
  postController.viewEditScreen
)
router.post(
  '/post/:id/edit',
  userController.mustBeLoggedIn,
  postController.edit
)

router.post(
  '/post/:id/delete',
  userController.mustBeLoggedIn,
  postController.delete
)

module.exports = router