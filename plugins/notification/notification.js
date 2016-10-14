/**
 * @file
 * Handle PDF generation and printer events..
 */

var printer = require('printer');
var Mark = require('markup-js');
var twig = require('twig');
var nodemailer = require('nodemailer');
var i18n = require('i18n');

var Q = require('q');
var fs = require('fs');

var Notification = function Notification(bus) {
  "use strict";
  var self = this;
  this.bus = bus;

  bus.once('notification.config', function (data) {
    self.mailConfig = data.mailer;
    self.headerConfig = data.header;
    self.libraryHeader = data.library;
    self.footer = data.footer;
    self.layouts = data.layouts;

    self.mailTransporter = nodemailer.createTransport({
      'host': self.mailConfig.host,
      'port': self.mailConfig.port,
      'secure': self.mailConfig.secure,
      'ignoreTLS': !self.mailConfig.secure
    });
  });
  bus.emit('config.notification', {'busEvent': 'notification.config'});

  // Configure I18N with supported languages.
  i18n.configure({
    locales:['en', 'da'],
    defaultLocale: 'en',
    indent: "  ",
    autoReload: true,
    directory: __dirname + '/locales'
  });

  twig.extendFilter('translate', function (str) {
    return i18n.__(str);
  });

  // Load template snippets.
  this.mailTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/receipt.html', 'utf8')
  });
  this.textTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/receipt.txt', 'utf8')
  });

  // Load library header templates.
  this.mailLibraryTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/library.html', 'utf8')
  });
  this.textLibraryTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/library.txt', 'utf8')
  });

  // Load fines templates.
  this.mailFinesTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/fines.html', 'utf8')
  });
  this.textFinesTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/fines.txt', 'utf8')
  });

  // Load loans templates.
  this.mailLoansTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/loans.html', 'utf8')
  });
  this.textLoansTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/loans.txt', 'utf8')
  });

  // Load new loans templates.
  this.mailLoansNewTemplate = fs.readFileSync(__dirname + '/templates/loans_new.html', 'utf8');
  this.textLoansNewTemplate = fs.readFileSync(__dirname + '/templates/loans_new.txt', 'utf8');

  // Load reservations ready templates.
  this.mailReservationsReadyTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/reservations_ready.html', 'utf8')
  });
  this.textReservationsReadyTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/reservations_ready.txt', 'utf8')
  });

  // Load reservations templates.
  this.mailReservationsTemplate = twig.twig({
    'data':  fs.readFileSync(__dirname + '/templates/reservations.html', 'utf8')
  });
  this.textReservationsTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/reservations.txt', 'utf8')
  });

  // Load check-in templates.
  this.mailCheckInTemplate = fs.readFileSync(__dirname + '/templates/checkin.html', 'utf8');
  this.textCheckInTemplate = fs.readFileSync(__dirname + '/templates/checkin.txt', 'utf8');

  // Load footer templates.
  this.mailFooterTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/footer.html', 'utf8')
  });
  this.textFooterTemplate = twig.twig({
    'data': fs.readFileSync(__dirname + '/templates/footer.txt', 'utf8')
  });

  // Get default printer name and use that as printer.
  this.defaultPrinterName = printer.getDefaultPrinterName();
};

/**
 * Get name of the default system printer.
 *
 * @returns string
 *   Name of the printer.
 */
Notification.prototype.getDefaultPrinterName = function getDefaultPrinterName() {
  return this.defaultPrinterName;
};

/**
 * Render library information.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @returns {*}
 */
Notification.prototype.renderLibrary = function renderLibrary(html) {
  if (html) {
    return this.mailLibraryTemplate.render(this.libraryHeader);
  }
  else {
    return this.textLibraryTemplate.render(this.libraryHeader);
  }
};

/**
 * Render fines information.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @param fines
 *   The fine elements to render.
 *
 * @returns {*}
 *
 */
Notification.prototype.renderFines = function renderFines(html, fines) {
  if (html) {
    return this.mailFinesTemplate.render({'items': fines});
  }
  else {
    return this.textFinesTemplate.render({'items': fines});
  }
};

/**
 * Render loans information.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @param headline
 *   Section title.
 * @param loans
 *   The fine elements to render.
 * @param overdue
 *   Loan that is overdue
 *
 * @returns {*}
 */
Notification.prototype.renderLoans = function renderLoans(html, headline, loans, overdue) {
  // Merge information about overdue loans into loans objects.
  overdue.map(function (overdueLoan) {
    loans.find(function (obj) {
      if (obj.id === overdueLoan.id) {
        obj.overdue = true;
      }
    });
  });

  if (html) {
    return this.mailLoansTemplate.render({
      'headline': headline,
      'items': loans
    });
  }
  else {
    return this.textLoansTemplate.render({
      'headline': headline,
      'items': loans
    });
  }
};

/**
 * Render new loans list.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @param title
 *   Section title.
 * @param items
 *   The new loan items.
 *
 * @returns {*}
 */
Notification.prototype.renderNewLoans = function renderNewLoans(html, title, items){
  if (html) {
    return Mark.up(this.mailLoansNewTemplate, {
      'title': title,
      'items': items
    });
  }
  else {
    return Mark.up(this.textLoansNewTemplate, {
      'title': title,
      'items': items
    });
  }
};

/**
 * Render reservations ready for pick-up.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @param reservations
 *   The reservation elements to render.
 *
 * @returns {*}
 */
Notification.prototype.renderReadyReservations = function renderReadyReservations(html, reservations) {
  if (html) {
    return this.mailReservationsReadyTemplate.render({'items': reservations});
  }
  else {
    return this.textReservationsReadyTemplate.render({'items': reservations});
  }
};

/**
 * Render reservations for pick-up.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @param reservations
 *   The reservation elements to render.
 *
 * @returns {*}
 *
 */
Notification.prototype.renderReservations = function renderReservations(html, reservations) {
  if (html) {
    return this.mailReservationsTemplate.render({'items': reservations});
  }
  else {
    return this.textReservationsTemplate.render({'items': reservations});
  }
};

/**
 * Render checked in items.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @param items
 *   Returned items.
 *
 * @returns {*}
 */
Notification.prototype.renderCheckIn = function renderCheckIn(html, items) {
  if (html) {
    return Mark.up(this.mailCheckInTemplate, {'items': items});
  }
  else {
    return Mark.up(this.textCheckInTemplate, {'items': items});
  }
};

/**
 * Render footer.
 *
 * @param html
 *   If TRUE HTML is outputted else clean text.
 * @returns {*}
 */
Notification.prototype.renderFooter = function renderFooter(html) {
  if (html) {
    return this.mailFooterTemplate.render({ 'debug': true, 'content': this.footer.html });
  }
  else {
    return this.textFooterTemplate.render({ 'text': this.footer.text });
  }
};

/**
 * Check in receipt (return items).
 *
 * @param mail
 *   If TRUE send mail else print receipt.
 * @param items
 */
Notification.prototype.checkInReceipt = function checkInReceipt(mail, items) {
  var self = this;
  var deferred = Q.defer();
  var layout = self.layouts.checkIn;

  // i18n.setLocale('de');

  // Listen for status notification message.
  this.bus.once('notification.patronReceipt', function (data) {
    // Options on what to include in the notification.
    var options = {
      includes: {
        library: self.renderLibrary(mail),
        footer: self.renderFooter(mail),
        check_ins: layout.check_ins ? self.renderCheckIn(mail, items) : '',
        fines: layout.fines ? self.renderFines(mail, data.fineItems) : '',
        loans_new: layout.loans_new ? self.renderNewLoans(mail, 'Lån', items) : '',
        loans: layout.loans ? self.renderLoans(mail, 'Lån', data.chargedItems) : '',
        reservations: layout.reservations ? self.renderReservations(mail, data.unavailableHoldItems) : '',
        reservations_ready: layout.reservations_ready ? self.renderReadyReservations(mail, data.holdItems) : '',
        pokemon: layout.pokemon ? 'true' : ''
      }
    };

    // Data for the main render.
    var context = {
      'name': data.hasOwnProperty('homeAddress') ? data.homeAddress.Name : 'Unknown',
      'header': self.headerConfig
    };

    var result = '';
    if (mail && (data.hasOwnProperty('emailAddress') && data.emailAddress !== undefined)) {
      result = Mark.up(self.mailTemplate, context, options);

      self.sendMail(data.emailAddress, result).then(function () {
        deferred.resolve();
      }, function (err) {
        deferred.reject(err);
      });
    }
    else {
      result = Mark.up(self.textTemplate, context, options);

      // Remove empty lines (from template engine if statements).
      result = result.replace(/(\r\n|\r|\n){2,}/g, '$1\n');

      // Print it.
      self.print(result);
      deferred.resolve();
    }
  }, function (err) {
    deferred.reject(err);
  });

  // Request the data to use in the notification.
  this.bus.emit('fbs.patron', {
    'username': items[0].patronIdentifier,
    'password': '',
    'busEvent': 'notification.patronReceipt'
  });

  return deferred.promise;
};

/**
 * Check out receipt (loan items).
 *
 * @param mail
 *   If TRUE send mail else print receipt.
 * @param items
 * @param username
 * @param password
 */
Notification.prototype.checkOutReceipt = function checkOutReceipt(mail, items, username, password) {
  var self = this;
  var deferred = Q.defer();
  var layout = self.layouts.checkOut;

  // i18n.setLocale('de');

  // Filter out failed loans.
  items.map(function (item, index) {
    if (item.status === 'borrow.error') {
      items.splice(index, 1);
    }
  });

  // Listen for status notification message.
  this.bus.once('notification.patronReceipt', function (data) {
    // Options on what to include in the notification.
    var options = {
      includes: {
        library: self.renderLibrary(mail),
        footer: self.renderFooter(mail),
        fines: layout.fines ? self.renderFines(mail, data.fineItems) : '',
        loans_new: layout.loans_new ? self.renderNewLoans(mail, 'Lån', items) : '',
        loans: layout.loans ? self.renderLoans(mail, 'Lån', data.chargedItems) : '',
        reservations: layout.reservations ? self.renderReservations(mail, data.unavailableHoldItems) : '',
        reservations_ready: layout.reservations_ready ? self.renderReadyReservations(mail, data.holdItems) : '',
        pokemon: layout.pokemon ? 'true' : ''
      }
    };

    // Data for the main render.
    var context = {
      'name': data.hasOwnProperty('homeAddress') ? data.homeAddress.Name : 'Unknown',
      'header': self.headerConfig
    };

    var result = '';
    if (mail && (data.hasOwnProperty('emailAddress') && data.emailAddress !== undefined)) {
      result = Mark.up(self.mailTemplate, context, options);

      self.sendMail(data.emailAddress, result).then(function () {
        deferred.resolve();
      }, function (err) {
        deferred.reject(err);
      });
    }
    else {
      result = Mark.up(self.textTemplate, context, options);

      // Remove empty lines (from template engine if statements).
      result = result.replace(/(\r\n|\r|\n){2,}/g, '$1\n');

      // Print it.
      self.print(result);
      deferred.resolve();
     }
   }, function (err) {
     deferred.reject(err);
  });

   // Request the data to use in the notification.
   this.bus.emit('fbs.patron', {
     'username': username,
     'password': password,
     'busEvent': 'notification.patronReceipt'
   });

  return deferred.promise;
};

/**
 *
 * @param type
 * @param mail
 *   If TRUE send mail else print receipt.
 * @param username
 * @param password
 *
 * @return {*|promise}
 *   Resolved or error message on failure.
 */
Notification.prototype.patronReceipt = function patronReceipt(type, mail, username, password) {
  var self = this;
  var deferred = Q.defer();
  var layout = self.layouts[type];

  // i18n.setLocale('de');

  // Listen for status notification message.
  this.bus.once('notification.patronReceipt', function (data) {
    var context = {
      'name': data.hasOwnProperty('homeAddress') ? data.homeAddress.Name : 'Unknown',
      'header': self.headerConfig,
      'library': self.renderLibrary(mail),
      'fines': layout.fines ? self.renderFines(mail, data.fineItems) : '',
      'loans': layout.loans ? self.renderLoans(mail, 'receipt.loans.headline', data.chargedItems, data.overdueItems) : '',
      'reservations': layout.reservations ? self.renderReservations(mail, data.unavailableHoldItems) : '',
      'reservations_ready': layout.reservations_ready ? self.renderReadyReservations(mail, data.holdItems) : '',
      'footer': self.renderFooter(mail)
    };

    var result = '';
    if (mail && (data.hasOwnProperty('emailAddress') && data.emailAddress !== undefined)) {
      result = self.mailTemplate.render(context);

      self.sendMail(data.emailAddress, result).then(function () {
        deferred.resolve();
      }, function (err) {
        deferred.reject(err);
      });
    }
    else {
      result = self.textTemplate.render(context);

      // Remove empty lines (from template engine if statements).
      result = result.replace(/(\r\n|\r|\n){2,}/g, '$1\n');

      // Print it.
      self.print(result);
      deferred.resolve();
    }
  }, function (err) {
    deferred.reject(err);
  });

  // Request the data to use in the notification.
  this.bus.emit('fbs.patron', {
    'username': username,
    'password': password,
    'busEvent': 'notification.patronReceipt'
  });

  return deferred.promise;
};

/**
 * Send mail notification.
 *
 * @param to
 *   The mail address to send mail to.
 * @param content
 *   The html content to send.
 */
Notification.prototype.sendMail = function sendMail(to, content) {
  var deferred = Q.defer();

  var self = this;
  var mailOptions = {
    from: self.mailConfig.from,
    to: to,
    subject: self.mailConfig.subject,
    html: content
  };

  // Send mail with defined transporter.
  self.mailTransporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      self.bus.emit('logger.err', error);
      deferred.reject(error);
    }
    else {
      self.bus.emit('logger.info', 'Mail sent to: ' + to);
      deferred.resolve();
    }
  });

  return deferred.promise;
};

/**
 * Print receipt.
 *
 * @param content
 */
Notification.prototype.print = function print(content) {
  /**
   * @TODO: Print the receipt.
   */
};

/**
 * Register the plugin with architect.
 */
module.exports = function (options, imports, register) {
  var bus = imports.bus;
  var notification = new Notification(bus);

  /**
   * Listen status receipt events.
   */
  bus.on('notification.status', function (data) {
    notification.patronReceipt('status', data.mail, data.username, data.password).then(
      function () {
        bus.emit(data.busEvent, true);
      },
      function (err) {
        bus.emit(data.busEvent, err);
      }
    );
  });

  /**
   * Listen status receipt events.
   */
  bus.on('notification.reservations', function (data) {
    notification.patronReceipt('reservations', data.mail, data.username, data.password).then(
      function () {
        bus.emit(data.busEvent, true);
      },
      function (err) {
        bus.emit(data.busEvent, err);
      }
    );
  });

  /**
   * Listen check-out (loans) receipt events.
   */
  bus.on('notification.checkOut', function (data) {
    notification.checkOutReceipt(data.mail, data.items, data.username, data.password).then(
      function () {
        bus.emit(data.busEvent, true);
      },
      function (err) {
        bus.emit(data.busEvent, err);
      }
    );
  });

  /**
   * Listen check-in (returns) receipt events.
   */
  bus.on('notification.checkIn', function (data) {
    notification.checkInReceipt(data.mail, data.items).then(
      function () {
        bus.emit(data.busEvent, true);
      },
      function (err) {
        bus.emit(data.busEvent, err);
      }
    );
  });

  notification.patronReceipt('status', true, '3208100032', '12345');

  register(null, {
    "notification": notification
  });
};
