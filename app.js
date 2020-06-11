const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const flash = require('connect-flash')
const markdown = require('marked')
const app = express()
const sanitizeHTML = require('sanitize-html')

let sessionOptions = session({
  //Boiler plate config options
  secret: 'JavaScript rules',
  store: new MongoStore({ client: require('./db') }),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true },
})

app.use(sessionOptions)
app.use(flash())

//With the middleware right below we have access to a user object from our ejs templates
app.use(function (req, res, next) {
  //Make or markdown function available from ejs templates
  res.locals.filterUserHTML = function (content) {
    return sanitizeHTML(markdown(content), {
      allowedTags: [
        'p',
        'br',
        'ul',
        'ol',
        'li',
        'strong',
        'bold',
        'i',
        'em',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
      ],
      allowedAttributes: {},
    })
  }

  //Make all error and success flash messages available from all templates
  res.locals.errors = req.flash('errors')
  res.locals.success = req.flash('success')

  //Make current user id available on the req object
  if (req.session.user) {
    req.visitorId = req.session.user._id
  } else {
    req.visitorId = 0
  }

  //Make user session available from within view templates

  res.locals.user = req.session.user
  next()
})

const router = require('./router')

app.use(express.urlencoded({ extended: false })) //Boiler plate code that tells express to add the user-submitted data to our req object (submit form)

app.use(express.json()) //Same as urlencoded method but for data in json format

app.use(express.static('public')) //This line makes the files in public accessible

app.set('views', 'views') // First argument is an express option, second argument is our folder with the HTML templates
app.set('view engine', 'ejs')

app.use('/', router)

module.exports = app
