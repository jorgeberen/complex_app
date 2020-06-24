const dotenv = require('dotenv')
dotenv.config()
const mongodb = require('mongodb')

mongodb.connect(process.env.CONNECTIONSTRING, { useNewUrlParser: true, useUnifiedTopology: true }, function(
	err,
	client
) {
	module.exports = client // This way we can use this file from other files
	const app = require('./app') // This way the first file to be executed in our app is db.js and we connect to the database bedore rendering anything
	app.listen(process.env.PORT)
})
