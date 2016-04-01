const http = require('http');
const soap = require('soap');
const fs = require('fs');
const low = require('lowdb')
const storage = require('lowdb/file-sync')
const db = low('db.json', { storage })('users');

function __(value) {
  return value.$value || value;
}


function SoapError(text) {
  return {
    Fault: {
      Code: {
        Value: "soap:Sender",
        Subcode: { value: "rpc:BadArguments" }
      },
      Reason: { Text: text },
      statusCode: 400
    }
  };
}

const idGenerator = (function* idGenerator() {
  let { id } = (db.last() || { id: 0 });
  while (1) {
    yield ++id;
  }
})();

const service = {
  'microservice.users.UserControllerService': {
    'microservice.users.UserControllerPort': {
      register: function (args) {
        const email = __(args.email);
        const password = __(args.password);
        // FIXME: check that email is valid
        if (db.find({ email })) {
          throw new SoapError('already registered');
        }

        const user =  {
          id: idGenerator.next().value,
          email,
          password,
          role: 'client'
        };

        db.push(user);
        return user;
      },

      login: function(args) {
        const email = __(args.email);
        const password = __(args.password);
        const user = db.find({ email, password });
        if (!user) {
          throw new SoapError('no such user');
        }

        return user;
      },

      getUserById: function(args) {
        const id = +__(args.id);
        const user = db.find({ id });

        if (!user) {
          throw new SoapError('no such user');
        }

        return user;
      },

      deleteUser: function(args) {
        const id = +__(args.id);
        const user = db.find({ id });
        if (!user) {
          throw new SoapError('no such user');
        }
        db.remove({ id });
        return;
      },

      changeUser: function(args) {
        console.log(args);
        const id = +__(args.user.id);
        console.log(id);
        const user = db.find({ id });
        if (!user) {
          throw new SoapError('no such user');
        }
        const newUser = Object.assign({}, user, args.user, { id });
        db.remove({ id });
        db.push(newUser);
        return newUser;
      },

      getUsersListByRole: function(args) {
        const { role } = args;
        const users = db.filter({ role });
        return {
          'tns:users': {
            user: users
          }
        };
      }
    }
  }
};

var xml = require('fs').readFileSync('users.wsdl', 'utf8'),
server = http.createServer(function(request,response) {
  response.setHeader('Content-Type', 'text/xml');
  response.end(xml);
});

server.listen(3001);
soap.listen(server, '/users', service, xml);
console.log('launched');
