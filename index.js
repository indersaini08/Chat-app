var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var bodyParser  = require('body-parser');
var cookieParser = require('cookie-parser');
var jwt    = require('jsonwebtoken');
var mongoose = require('mongoose');
var User = require('./models/user');
var UserGroup = require('./models/usergroup');
var Message = require('./models/message');

mongoose.connect('mongodb://localhost/chatdata');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({limit: '5mb',extended: false }));
app.use(cookieParser());
var clients=[];

app.get('/', function(req, res){
  if(req.cookies && req.cookies.token){
	jwt.verify(req.cookies.token,'secret',function(error,data){
		if(data){
			var newClient={};
					newClient.primaryNumber=data.primaryNumber;
					newClient.id=undefined;
					checkAlreadyLoggedIn(data.primaryNumber,function(result){
						if(!result)
							clients.push(newClient);
					});
			res.sendFile(__dirname + '/index.html');
			}
		else
			res.sendFile(__dirname + '/login.html');
	});
  }
  else
	res.sendFile(__dirname + '/login.html');
});

app.get('/logout', function (req, res) {
	if(req.cookies.token){
		res.clearCookie('token');
	}
	res.redirect('/');
});

app.get('/register',function(req, res){
	res.sendFile(__dirname + '/register.html');
});

app.post('/login', function(req, res){
  if(req.body.primaryNumber!==undefined){
    validateUser(req.body.primaryNumber,function(userId){
		if(userId){
			authenticateUser(req.body.primaryNumber,req.body.password,function(userId){
				if(userId){
					var token = jwt.sign({primaryNumber:req.body.primaryNumber}, 'secret', {
										expiresIn: 1440
								});
					var newClient={};
					newClient.primaryNumber=req.body.primaryNumber;
					newClient.id=undefined;
					checkAlreadyLoggedIn(req.body.primaryNumber,function(result){
						if(!result)
							clients.push(newClient);
					});
					
					res.cookie('token',token);
					res.redirect('/');
				}
				else
					res.sendFile(__dirname + '/login.html');
			});
		}
	});
	
  }
});

app.post('/register', function (req, res) {
	var newUser = new User({
				primaryNumber	: req.body.primaryNumber,
				name		    : req.body.name,
				secondaryNumbers: [],
				email     		: req.body.email,
				lastSeen		: new Date,
				status			: req.body.status,
				ProfilePic		: {data: 'lovewala.png', contentType: 'image/png'},
				password  		: req.body.password,
				Contacts		: [],
				_id				: new mongoose.Types.ObjectId
			});
	newUser.save(function(error,newUser){
		if(newUser)
			res.sendFile(__dirname + '/login.html');
		else
			res.sendFile(__dirname + '/register.html');
	});

});

app.get('/openChat/group/:groupId',function(req,res){
	res.cookie('currentChat',req.params.groupId);
	res.cookie('isGroupChat',true);
	res.sendFile(__dirname + '/chatPage.html');
});

app.get('/openChat/single/:userId',function(req,res){
	res.cookie('currentChat',req.params.userId);
	res.cookie('isGroupChat',false);
	res.sendFile(__dirname + '/chatPage.html');
});


io.on('connection', function(socket){
  //console.log(socket.id);
  //console.log(clients);
  
  
  socket.emit('connect1');
  socket.on('disconnect',function(){
	console.log('disconnected');
  })
  socket.on('userChats', function(msg){
	var token = msg.token;
	if(token) {
		jwt.verify(token,'secret',function(error,data){
			if(data){
				updateSockets(data.primaryNumber,socket.id);
				validateUser(data.primaryNumber,function(userId){
				if(userId){
				    //console.log('User: '+userId);
					returnUserChats(userId,function(userChats){
						io.sockets.connected[socket.id].emit('userChats', userChats);
					});
				}
					
			});
			}
		});
	}
    else{
		io.sockets.connected[socket.id].emit('userChats', []);
	}
	});
	
	socket.on('addContact',function(msg){
		var backData={};
		backData.status=true;
		var token = msg.token;
		if(token) {
			jwt.verify(token,'secret',function(error,data){
				if(data){	
					User.findOne({'primaryNumber':data.primaryNumber},function(e,user){
						if(user){
							User.findOne({'primaryNumber':msg.primaryNumber},function(err,contact){
								if(contact){
									var duplicate=false;
									for(var i=0;i<user.Contacts.length;i++){
										if(user.Contacts[i].userId==contact._id){
											duplicate=true;
											break;
										}
									}
									if(duplicate===false){
										user.Contacts.push({'userId':contact._id});
										user.save(function(er,saved){
											if(saved){
												returnUserContacts(user._id,function(userContacts){
													io.sockets.connected[socket.id].emit('userContacts', userContacts);
												});
											}
												
										});
									}
									
								}
							});
						}
					});
				}
			});
		}
	});
	
	socket.on('userContacts', function(msg){
	
	var token = msg.token;
	if(token) {
		jwt.verify(token,'secret',function(error,data){
			if(data){	
			//updateSockets(data.primaryNumber,socket.id);
			validateUser(data.primaryNumber,function(userId){
				if(userId){
				    //console.log(userId);
					returnUserContacts(userId,function(userContacts){
					    //console.log('Sending: '+userContacts);
						userContacts=JSON.stringify(userContacts);
						io.sockets.connected[socket.id].emit('userContacts', userContacts);
					});
				}
					
			});
			}
		});
	}
    else{
		io.sockets.connected[socket.id].emit('userContacts', []);
	}
	});
	
	socket.on('userGroups', function(msg){
	console.log('Received userGroups event');
	var token = msg.token;
	if(token) {
		jwt.verify(token,'secret',function(error,data){
			if(data){
			validateUser(data.primaryNumber,function(userId){
				if(userId){
					returnUserGroups(userId,function(userGroups){
						console.log('User Groups sending back : '+userGroups);
						io.sockets.connected[socket.id].emit('userGroups', userGroups);
					});
				}
					
			});
			}
		});
	}
    else{
		io.sockets.connected[socket.id].emit('userGroups', []);
	}
	});
  
  socket.on('fetchChat',function(data){
		var token = data.token;
		if(token) {
			jwt.verify(token,'secret',function(error,decoded){
				if(decoded){
					validateUser(decoded.primaryNumber,function(fromId){
						if(fromId)
							updateSockets(decoded.primaryNumber,socket.id);
							//console.log('Initially: '+data.isGroupChat+' '+fromId+' '+data.to);
							
							returnEarlierChat(data.isGroupChat,fromId,data.to,function(messages){
								console.log('Returned Messages: '+messages);
								io.sockets.connected[socket.id].emit('previousMessages',messages);
							});
						});
					}
			});
		};
	});
  
  socket.on('newGroup', function(msg){
    console.log('Received newGroup event!');
	var token = msg.token;
	if(token) {
		jwt.verify(token,'secret',function(error,data){
			if(data){
			validateUser(data.primaryNumber,function(fromId){
				if(fromId){
					var newMembers=msg.data.members;
					newMembers.push({'userId':fromId,'isAdmin':true});
					console.log(JSON.stringify(newMembers));
					var newGroup=new UserGroup({
										_id				: new mongoose.Types.ObjectId,
										groupName		: msg.data.groupName,
										status			: 'Hi there!',
										profilePic		: null,
										members			: newMembers
									});
					
					newGroup.save(function(error,group){
						if(error)
							console.log(error)
						else
							console.log('Saved Group: ' + group);
					});
				}
				});
			}
		});
	}
	});
  
  
  socket.on('chat message', function(msg){
	var clientFound=false;
	msg=JSON.parse(msg);
	var token = msg.token;
	if(token) {
		jwt.verify(token,'secret',function(error,data){
			if(data){
			validateUser(data.primaryNumber,function(fromId){
				if(fromId){
						//console.log('msg.isGroupChat: '+msg.isGroupChat);
						//console.log(typeof msg.isGroupChat);
					    if(msg.isGroupChat==='true'){
							console.log('Group Chat From: '+data.primaryNumber+' To: '+msg.to+' Message: '+msg.message);
							var newMessage=new Message({
										_id				: new mongoose.Types.ObjectId,
										sender	 		: fromId,
										recepient		: null,
										group			: msg.to,
										messageText		: msg.message,
										multimediaMsg	: null,
										sentTime		: new Date,
										receivedTime	: new Date
									});
									newMessage.save(function(error,m){
														if(m){
															console.log('findSocketsForGroupId: '+msg.to);
															findSocketsForGroup(msg.to,function(socketIds){
																for(var k=0;k<socketIds.length;k++){
																	io.sockets.connected[socketIds[k]].emit('chat message', msg.message);
																}
															});
														}
									});
							
						}
						else{
							console.log('Recepient: '+msg.to);
							User.findOne({'_id':msg.to},function(e,user){
								var newMessage=new Message({
										_id				: new mongoose.Types.ObjectId,
										sender	 		: fromId,
										recepient		: msg.to,
										group			: null,
										messageText		: msg.message,
										multimediaMsg	: null,
										sentTime		: new Date,
										receivedTime	: new Date
									});
								newMessage.save(function(error,savedMsg){
														if(savedMsg){
														    console.log('Issue here: '+msg.message);
															io.sockets.connected[socket.id].emit('chat message', msg.message);
															for(var k=0;k<clients.length;k++){
																//console.log('Right now: '+clients);
																//console.log('Recepient primary number: '+user.primaryNumber);
																if(clients[k].primaryNumber==user.primaryNumber)
																	io.sockets.connected[clients[k].id].emit('chat message', msg.message);
															}
															
															/* findSocketForUser(user.primaryNumber,function(index){
																console.log('Index: '+index);
																io.sockets.connected[clients[index].id].emit('chat message', msg.message);
															}); */
														}
								});
							});
							
						}  
					
				}
			});
		  }
		});
	}	
  });
  
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});


//---------------------------Utility Functions----------------------------------




var validateUser=function(primaryNumber,callback){
    console.log(primaryNumber);
	User.findOne({'primaryNumber':primaryNumber},function(err,user){
		if(user)
			callback(user._id);
	});
};

var authenticateUser=function(primaryN,pwd,callback){
	User.findOne({'primaryNumber':primaryN,password:pwd},function(err,user){
		if(user)
			callback(user._id);
	});
};


var returnUserChats=function(userId,callback){
	var chatMessages=[];
	var chats=[];
	returnUserGroups(userId,function(groups){
	  var groupIds=[];
	  for(var i=0;i<groups.length;i++)
		groupIds.push(groups[i]._id);
	  Message.find({
      $or: [
          {'sender':userId },
		  {'group':{ $in : groupIds }},
          {'recepient':userId}
			]
		},function(error,messages){
			for(var i=0;i<messages.length;i++)
				chatMessages.push(messages[i]);
			});
		});
};


var returnUserContacts=function(userId,callback){
    var userContacts=[];
	var i=0;
	User.findOne({'_id':userId},function(err,user){
		//console.log(user.Contacts);
	    if(user.Contacts){
			for(i=0;i<user.Contacts.length;i++){
				User.find({'_id':user.Contacts[i].userId},function(error,usr){
					userContacts.push(usr);
					console.log(usr);
				});
				//callback(userContacts);
				setTimeout(callback,2000,userContacts);
			}
			
		}
	});
};


/* var returnUserContactsDummy=function(userId,callback){
    var userContacts=[];
	
	User.findOne({'_id':userId},function(err,user){
		//console.log(user);
		if(user && user.primaryNumber=='7205437987'){
			User.findOne({'primaryNumber':'777777'},function(err,user){
			userContacts.push(user);
			callback(userContacts);
			});
		}
		else if(user && user.primaryNumber=='777777'){
			User.findOne({'primaryNumber':'7205437987'},function(err,user){
			userContacts.push(user);
			callback(userContacts);
			});
		} 
	});		
};
 */
/* returnUserContactsDummy('asd',function(userContacts){
	console.log(userContacts);
});
 */
var returnUserGroups=function(userId,callback){
	UserGroup.find({'members.userId':userId},function(err,usergroups){
		callback(usergroups);
	});
};


var returnEarlierChat=function(isGroup,fromId,toId,callback){
    var msgs=[];
	console.log(isGroup+' '+fromId+' '+toId);
	if(isGroup===true){
		Message.find({'group':toId},function(error,messages){
			if(messages){
				for(i=0;i<messages.length;i++){
					var newMsg={};
					findName(isGroup,messages[i].sender,function(name){
						newMsg.fromName=name;
						
					});
					newMsg.message=messages[i].messageText;
					msgs.push(newMsg);
				}
				console.log('GroupMessages: '+JSON.stringify(msgs));
				callback(msgs);
			}
		});
	}
	else{
		Message.find({'sender':fromId,'recepient':toId},function(error,messages){
			if(messages){
				console.log('sender '+fromId+' recepient'+toId);
				console.log('Reached here1 '+messages.length);
				for(i=0;i<messages.length;i++){
					var newMsg={};
					Message.findOne({'_id':fromId},function(e,u){
						if(u){
							newMsg.fromName=u.name;
							console.log(u.name);
							newMsg.message=messages[i].messageText;
							msgs.push(newMsg);
						}
					});
					
				}
				Message.find({'sender':toId,'recepient':fromId},function(error,moreMessages){
					if(moreMessages){
						console.log('sender '+toId+' recepient'+fromId);
						console.log('Reached here1 '+moreMessages.length);
						for(i=0;i<moreMessages.length;i++){
							var newMsg={};
							Message.findOne({'_id':toId},function(e,u){
								if(u){
									newMsg.fromName=u.name;
									console.log(u.name);
									newMsg.message=messages[i].messageText;
									msgs.push(newMsg);
								}
							});
							newMsg.message=moreMessages[i].messageText;
							msgs.push(newMsg);
						}
					}
					console.log('IndividualMessages: '+JSON.stringify(msgs));
					callback(msgs);
				});
				
				
			}
		});
	}
}
/* 
returnEarlierChat(false,'591db8d817a36c2fa88b1946','591db91517a36c2fa88b1947',function(messages){
	console.log('Messages : '+messages);
}); */

var checkAlreadyLoggedIn=function(primaryNumber,callback){
	for(var i=0;i<clients.length;i++){
		if(clients[i].primaryNumber==primaryNumber)
			return callback(true);
	}
	callback(false);
}

var findName=function(isGroup,id,callback){
	if(isGroup===true){
		UserGroup.findOne({'_id':id},function(error,group){
			//console.log(group.groupName);
			callback(group.groupName);
		});
	}
	else{
		User.findOne({'_id':id},function(error,user){
			//console.log(user.name);
			callback(user.name);
		});
	}
}

var findSocketsForGroup=function(groupId,callback){
	UserGroup.findOne({'_id':groupId},function(error,group){
		var members=[];
		console.log('Found Group: '+JSON.stringify(group));
		 for(var i=0;i<group.members.length;i++){
		    //console.log('Found group user: '+JSON.stringify(group.members[i].userId));
			var userId=group.members[i].userId;
			User.findOne({'_id':userId},function(err,user){
				//console.log('Found group user: '+);
				for(var j=0;j<clients.length;j++){
					if(clients[j].primaryNumber==user.primaryNumber){
						members.push(clients[j].id);
						break;
					}
		
				}
				
			});
			console.log(members);
		callback(members);
			
		} 
		
	});
}

var findSocketForUser=function(primaryNumber,callback){
	
	callback(null);
}

var updateSockets=function(primaryNumber,id){
	for(var i=0;i<clients.length;i++){
		if(clients[i].primaryNumber==primaryNumber){
			clients[i].id=id;
			//console.log('After connection: '+clients);
			break;
		}
	}
}