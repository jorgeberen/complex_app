const bcrypt = require('bcryptjs')
const usersCollection = require('../db').db().collection('users')
const validator = require('validator')
const md5 = require('md5')

let User = function(data, getAvatar) {
	this.data = data
	this.errors = []
	if (getAvatar === undefined) {
		getAvatar = false
	}
	if (getAvatar) {
		this.getAvatar()
	}
}

User.prototype.cleanUp = function() {
	if (typeof this.data.username != 'string') {
		this.data.username = ''
	}
	if (typeof this.data.email != 'string') {
		this.data.email = ''
	}
	if (typeof this.data.password != 'string') {
		this.data.password = ''
	}

	// Get rid of any bogus properties
	this.data = {
		username: this.data.username.trim().toLowerCase(),
		email: this.data.email.trim().toLowerCase(),
		password: this.data.password
	}
}

User.prototype.validate = function() {
	return new Promise(async (resolve, reject) => {
		//We need to establish this function as asynchronous so that the await functions below work
		if (this.data.username === '') {
			this.errors.push('You must provide a username.')
		}
		if (this.data.username != '' && !validator.isAlphanumeric(this.data.username)) {
			this.errors.push('Username can only contain letters and numbers')
		}
		if (!validator.isEmail(this.data.email)) {
			this.errors.push('You must provide a valid email address.')
		}
		if (this.data.password === '') {
			this.errors.push('You must provide a password.')
		}
		if (this.data.password.length > 0 && this.data.password.length < 12) {
			this.errors.push('Password must be at least 12 characters')
		}
		if (this.data.password.length > 50) {
			this.errors.push('Password cannot exceed 50 characters')
		}
		if (this.data.username.length > 0 && this.data.username.length < 3) {
			this.errors.push('Username must be at least 3 characters')
		}
		if (this.data.username.length > 100) {
			this.errors.push('Username cannot exceed 100 characters')
		}

		// Only if username is valid, check to see if it exists already
		if (
			this.data.username.length > 2 &&
			this.data.username.length < 31 &&
			validator.isAlphanumeric(this.data.username)
		) {
			let usernameExists = await usersCollection.findOne({
				username: this.data.username
			}) //This promise will resolve to an object if the user is already registered in the DB. the findOne method returns a promise
			if (usernameExists) {
				this.errors.push('That username is already taken.')
			}
		}

		// Only if email is valid, check to see if it exists already

		if (validator.isEmail(this.data.email)) {
			let emailExists = await usersCollection.findOne({
				email: this.data.email
			}) //This promise will resolve to an object if the user is already registered in the DB. the findOne method returns a promise
			if (emailExists) {
				this.errors.push('That email is already taken.')
			}
		}
		resolve()
	})
}

User.prototype.login = function() {
	return new Promise((resolve, reject) => {
		this.cleanUp()
		usersCollection
			.findOne({ username: this.data.username })
			.then((attemptedUser) => {
				if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
					this.data = attemptedUser
					this.getAvatar()
					resolve('Congrats')
				} else {
					reject('Invalid Mate')
				}
			})
			.catch(function() {
				reject('Please try again later')
			})
	}) //Promise is capitalised because it is a blueprint = a constructor that we use to create new promises
}

User.prototype.register = function() {
	return new Promise(async (resolve, reject) => {
		//Step #1: Validate User Data
		this.cleanUp()
		await this.validate()
		//Step #2: Only if no validation errors, then save the user data into database
		if (!this.errors.length) {
			// Hashing the password
			let salt = bcrypt.genSaltSync(10)
			this.data.password = bcrypt.hashSync(this.data.password, salt)
			await usersCollection.insertOne(this.data)
			this.getAvatar()
			resolve()
		} else {
			reject(this.errors)
		}
	})
}

User.prototype.getAvatar = function() {
	this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}

User.findByUsername = function(username) {
	return new Promise(function(resolve, reject) {
		if (typeof username != 'string') {
			reject()
			return
		}
		usersCollection
			.findOne({ username: username }) //findOne returns the entire document with matching criteria, i.e. the entire user with all the keys that has a username of username
			.then(function(userDoc) {
				if (userDoc) {
					userDoc = new User(userDoc, true)
					userDoc = {
						_id: userDoc.data._id,
						username: userDoc.data.username,
						avatar: userDoc.avatar
					}
					resolve(userDoc)
				} else {
					reject()
				}
			})
			.catch(function() {
				reject()
			})
	})
}

User.doesEmailExist = function(email) {
	return new Promise(async function(resolve, reject) {
		if (typeof email != 'string') {
			resolve(false)
			return
		}
		let user = await usersCollection.findOne({ email: email })

		if (user) {
			resolve(true)
		} else {
			resolve(false)
		}
	})
}

module.exports = User
