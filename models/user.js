var mongoose = require('mongoose');

//mongoose.connect('mongodb://localhost/chatdata');

var Schema = mongoose.Schema;

var userSchema = new Schema({
	_id				: Schema.Types.ObjectId,
	primaryNumber	: { type: Number, required: true, unique: true },
    name		    : String,
	secondaryNumbers: [{contactNumber:Number}],
    email     		: String,
    lastSeen		: Date,
    status			: String,
	ProfilePic		: {data: Buffer, contentType: String},
	password  		: String,
	Contacts		: [{userId:String}]
});


var User = mongoose.model('User', userSchema);

module.exports = User;