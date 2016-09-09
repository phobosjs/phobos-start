'use strict';

if (!process.env.PORT) require('dotenv').load();

const opbeat = require('./config/opbeat');
const Phobos = require('phobosjs');
const passport = require('passport');
const session = require('express-session');
const Mailer = require('./lib/mailer');
const Slack = require('./lib/slack');
const Mailchimp = require('./lib/mailchimp');

const phobos = new Phobos({
  port: process.env.PORT || 5000,
  dbUri: process.env.MONGO_URI,
  bearerTokenSignature: process.env.BEARER_SIGNATURE
});

phobos.server.use(opbeat.middleware.express());

phobos.addSchema(require('./config/schema'));
phobos.initPlugins();

phobos.extend('mailer', new Mailer());
phobos.extend('slack', new Slack());
phobos.extend('mailchimp', new Mailchimp());

const DS = phobos.initDb();

phobos.server.use(session({
  secret: process.env.SESSION_KEY,
  resave: true,
  saveUninitialized: false
}));

phobos.addScopes(require('./config/scopes'));

phobos.addController(require('./controllers/users'));
phobos.addController(require('./controllers/pins'));

phobos.start();

phobos.server.use(passport.initialize());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(require('./auth/facebook')(DS));
passport.use(require('./auth/local')(DS));
passport.use(require('./auth/foursquare')(DS));
passport.use(require('./auth/twitter')(DS));

require('./auth/routes')(phobos, passport);

phobos.server.post('/invite', require('./routes/invite')(DS, phobos));
phobos.server.post('/event', require('./routes/event'));
phobos.server.get('/search', require('./routes/search')(DS, phobos));

phobos.server.get('/', (req, res, next) => {
  return res.send({
    api: process.env.API_NAME,
    framework: require('phobosjs/package.json').version,
    version: require('./package.json').version
  });
});

phobos.mountErrorHandler(require('./routes/errors')(phobos, DS));
