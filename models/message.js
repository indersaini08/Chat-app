var mongoose = require('mongoose');

//mongoose.connect('mongodb://localhost/chatdata');

var Schema = mongoose.Schema;

var messageSchema = new Schema({
	_id				: Schema.Types.ObjectId,
	sender	 		: String,
	recepient		: String,
	group			: String,
	messageText		: String,
	multimediaMsg	: {data: Buffer, contentType: String},
	sentTime		: Date,
	receivedTime	: Date
});


var Message = mongoose.model('Message', messageSchema);

module.exports = Message;