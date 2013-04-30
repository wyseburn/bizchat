/**
 * cluster 모듈 적용은 차후에...
 *
 * @author     	Yongseok Kang <wyseburn(at)gmail.com>
 * @copyright 	Copyright (c) 2011, Wowsoft co., ltd
 * @since       2013. 03. 11.
 * @category   
 * @version     
 */

var io = require('socket.io').listen(8080);

var Customer = {
	socket2Id : {},
	sockets : {},
	messages : {},
	enter : function(id, socket) {
		if(typeof(this.sockets[id]) == 'undefined') {
			this.sockets[id] = [];
			this.messages[id] = [];
		}
		this.sockets[id][socket.id] = socket;
		this.socket2Id[socket.id] = id;
	},
	isInRoom : function(id) {
		if(typeof(this.sockets[id]) == 'undefined')
			return false;
		else
			return true;
	},
	getSocket2Id : function(socket_id) {
		if(typeof(this.socket2Id[socket_id]) == 'undefined') {
			console.log('undefined sockets['+id+']');
			return null;
		}
		return this.socket2Id[socket_id];
	},
	getLastMsg : function(id) {
		if(typeof(this.messages[id]) == 'undefined')
			return [];
		
		return this.messages[id];
	},
	getAllMsg : function() {
		return this.messages;
	},
	addMsg : function(id, msg) {
		if(typeof(this.messages[id]) == 'undefined') {
			this.messages[id] = [];
		}
		if(this.messages[id].length >= 50) {
			this.messages[id].shift();
		}
		this.messages[id].push(msg);
	},
	getSockets : function(id) {
		if(typeof(this.sockets[id]) == 'undefined')
			return [];
		
		return this.sockets[id];
	},
	leave : function(socket_id) {
		var id = this.getSocket2Id(socket_id);
		if(id == null || typeof(this.sockets[id][socket_id]) == 'undefined') {
			console.log('undefined sockets['+id+']');
			return true;
		}
		
		delete this.sockets[id][socket_id];
		delete this.socket2Id[socket_id];
		if(Object.keys(this.sockets[id]).length == 0) {
			delete this.sockets[id];
			delete this.messages[id];
			var adminSockets = Admin.getSockets();
			if(adminSockets) {
				for(var i in adminSockets) {
					adminSockets[i].emit('leave', {id: id});
				}
			}
			return true;
		}
		return false;
	}
};

var Admin = {
	sockets : {},
	inFlag : false,
	is : function(socket_id) {
		if(typeof(this.sockets[socket_id]) == 'undefined')
			return false;
		else
			return true;
	},
	isInRoom : function() {
		return this.inFlag;
	},
	enter : function(socket) {
		if(typeof(this.sockets[socket.id]) == 'undefined')
			this.sockets[socket.id] = socket;

		this.inFlag = true;
	},
	leave : function(socket_id) {
		if(typeof(this.sockets[socket_id]) != 'undefined')
			delete this.sockets[socket_id];
		
		if(Object.keys(this.sockets).length == 0) {
			this.inFlag = false;
			return true;
		}
		else {
			this.inFlag = true;
			return false;
		}
	},
	getSockets : function() {
		if(!this.isInRoom())
			return [];
		
		return this.sockets;
	}
};

io.set('log level', 3);
io.sockets.on('connection', function(socket) {
	socket.on('customer_connect', function(req, fn) {
		if(!Customer.isInRoom(req.id)) {
			var admin_sockets = Admin.getSockets();
			for(var i in admin_sockets) {
				admin_sockets[i].emit('admin_create_room', {id: req.id});
			}
		}
		
		Customer.enter(req.id, socket);
		if(Admin.isInRoom()) {
			var lastMsg = Customer.getLastMsg(req.id);
			if(lastMsg.length) {
				fn({state: true, msg: lastMsg});
			}
			else {
				fn({state: true, msg: '시작합니다.'});
			}
		}
		else {
			fn({state: false, msg: '상담원이 자리에 없습니다.'});
		}
	});
	
	socket.on('customer_message', function(req) {
		Customer.addMsg(req.id, req.msg);
		var customer_sockets = Customer.getSockets(req.id);
		for(var i in customer_sockets) {
			if(customer_sockets[i].id != socket.id)
				customer_sockets[i].emit('message', {msg: req.msg, color: '#0000ff'});
		}
		
		var admin_sockets = Admin.getSockets();
		for(var i in admin_sockets) {
			admin_sockets[i].emit('message', {id: req.id, msg: req.msg, color: '#0000ff'});
		}
	});
	
	socket.on('1AE5D38B517_admin_connect', function(req) {
		if(!Admin.isInRoom())
			socket.broadcast.emit('admin_connect', {});
		
		Admin.enter(socket);
		socket.emit('admin_create_all_rooms', Customer.getAllMsg());
	});
	
	socket.on('3DE968DBBF4_admin_message', function(req) {
		Customer.addMsg(req.id, req.msg);
		var customer_sockets = Customer.getSockets(req.id);
		for(var i in customer_sockets) {
			customer_sockets[i].emit('message', {msg: req.msg, color: '#800000'});
		}
		
		var admin_sockets = Admin.getSockets();
		for(var i in admin_sockets) {
			if(i != socket.id)
				admin_sockets[i].emit('message', {id:req.id, msg: req.msg, color: '#800000'});
		}
	});
	
	socket.on('disconnect', function() {
		//페이지 이등, 새로고침 등으로 3초뒤에 소켓해제 처리함
		setTimeout(function() {
			if(Admin.is(socket.id)) {
				Admin.leave(socket.id);
				if(!Admin.isInRoom())
					socket.broadcast.emit('admin_leave', {});
			}
			else {
				var id = Customer.getSocket2Id(socket.id);
				if(Customer.leave(socket.id)) {
					var admin_sockets = Admin.getSockets();
					for(var i in admin_sockets) {
						admin_sockets[i].emit('admin_delete_room', {id: id});
					}
				}
			}
		}, 3000);
	});
});