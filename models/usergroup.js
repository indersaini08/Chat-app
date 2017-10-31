var mongoose = require('mongoose');

//mongoose.connect('mongodb://localhost/chatdata');

var Schema = mongoose.Schema;

var userGroupSchema = new Schema({
	_id				: Schema.Types.ObjectId,
	groupName	    : String,
	status			: String,
	profilePic		: {data: Buffer, contentType: String},
	members			: [{userId:String, isAdmin: Boolean}]
});


var UserGroup = mongoose.model('UserGroup', userGroupSchema);

module.exports = UserGroup;