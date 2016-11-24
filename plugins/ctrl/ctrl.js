/**
 * @file
 * Handles communication with the application and provides config.
 */
'use strict';

var Q = require('q');

var CTRL = function CTRL(bus, allowed) {
  var self = this;

  self.bus = bus;
  self.allowed = allowed;
};

/**
 * Get notification configuration.
 *
 * @returns {*|promise}
 */
CTRL.prototype.getFBSConfig = function getFBSConfig() {
  var deferred = Q.defer();

  this.bus.on('ctrl.fbs.loaded.config', function (data) {
    if (data instanceof Error) {
      deferred.reject(data);
    }
    else {
      deferred.resolve(data);
    }
  });
  this.bus.emit('storage.load', {
    type: 'config',
    name: 'fbs',
    busEvent: 'ctrl.fbs.loaded.config'
  });

  return deferred.promise;
};


/**
 * Get notification configuration.
 *
 * @returns {*|promise}
 */
CTRL.prototype.getNotificationConfig = function getNotificationConfig() {
  var deferred = Q.defer();

  this.bus.on('ctrl.notification.loaded.config', function (data) {
    if (data instanceof Error) {
      deferred.reject(data);
    }
    else {
      deferred.resolve(data);
    }
  });
  this.bus.emit('storage.load', {
    type: 'config',
    name: 'notification',
    busEvent: 'ctrl.notification.loaded.config'
  });

  return deferred.promise;
};

/**
 * Get the front-end (UI) configuration.
 *
 * NOTE: It uses a promise even though it don't needs to. This is to keep the
 *       code stream lined.
 */
CTRL.prototype.getUiConfig = function getUiConfig() {
  var deferred = Q.defer();

  this.bus.on('ctrl.loaded.ui.config', function (data) {
    if (data instanceof Error) {
      deferred.reject(data);
    }
    else {
      deferred.resolve(data);
    }
  });
  this.bus.emit('storage.load', {
    type: 'config',
    name: 'ui',
    busEvent: 'ctrl.loaded.ui.config'
  });

  return deferred.promise;
};

/**
 * Get all translations for the front-end.
 *
 * @returns {*|promise}
 */
CTRL.prototype.getTranslations = function getTranslations() {
  var deferred = Q.defer();

  this.bus.on('translations.request.languages', function (data) {
    if (data instanceof Error) {
      deferred.reject(data);
    }
    else {
      deferred.resolve(data);
    }
  });
  this.bus.emit('translations.request', {busEvent: 'translations.request.languages'});


  return deferred.promise;
};

/**
 * Register the plugin with architect.
 */
module.exports = function (options, imports, register) {

  var bus = imports.bus;
  var ctrl = new CTRL(bus, options.allowed);

  /**
   * Handle front-end (UI) configuration requests.
   */
  bus.on('ctrl.config.ui', function (data) {
    ctrl.getUiConfig().then(function (res) {
      bus.emit(data.busEvent, res);
    },
    function (err) {
      bus.emit('logger.err', 'CTRL: ' + err);
      bus.emit(data.errorEvent, err);
    });
  });

  /**
   * Handle front-end (UI) translations requests.
   */
  bus.on('ctrl.config.ui.translations', function (data) {
    ctrl.getTranslations().then(function (translations) {
      bus.emit(data.busEvent, {translations: translations});
    },
    function (err) {
      bus.emit('logger.err', 'CTRL: ' + err);
      bus.emit(data.errorEvent, err);
    });
  });

  /**
   * Handle notification config requests.
   */
  bus.on('ctrl.config.notification', function (data) {
    ctrl.getNotificationConfig().then(function (config) {
      bus.emit(data.busEvent, config);
    },
    function (err) {
      bus.emit('logger.err', 'CTRL: ' + err);
      bus.emit(data.errorEvent, err);
    });
  });

  /**
   * Handle notification config requests.
   */
  bus.on('ctrl.config.fbs', function (data) {
    ctrl.getFBSConfig().then(function (config) {
      bus.emit(data.busEvent, config);
    },
    function (err) {
      bus.emit('logger.err', 'CTRL: ' + err);
      bus.emit(data.errorEvent, err);
    });
  });

  /**
   * Create bridge to the bus from bootstrap control api.
   *
   * This is done via the process communication with the bootstrap process that
   * has forked this app.
   */
  process.on('message', function (data) {
    switch (data.command) {
      case 'reloadUi':
        bus.emit('frontend.reload');
        break;

      case 'config':
        bus.emit('storage.save', {
          type: 'config',
          name: 'ui',
          obj: data.config.ui,
          busEvent: 'storage.config.saved'
        });

        // Save fbs config.
        bus.emit('storage.save', {
          type: 'config',
          name: 'fbs',
          obj: data.config.fbs,
          busEvent: 'storage.config.saved'
        });

        // Save notification config.
        bus.emit('storage.save', {
          type: 'config',
          name: 'notification',
          obj: data.config.notification,
          busEvent: 'storage.config.saved'
        });
        break;

      case 'translations':
        // Save ui translation strings.
        if (data.translations.hasOwnProperty('ui')) {
          for (var key in data.translations.ui) {
            bus.emit('storage.save', {
              type: 'locales',
              name: 'ui/' + key,
              obj: data.translations.ui[key],
              busEvent: 'storage.translation.saved'
            });
          }
        }

        // Save notification translation strings.
        if (data.translations.hasOwnProperty('notification')) {
          for (var key in data.translations.notification) {
            bus.emit('storage.save', {
              type: 'locales',
              name: 'notifications/' + key,
              obj: data.translations.notification[key],
              busEvent: 'storage.translation.saved'
            });
          }
        }

        // @TODO: Emit translations to UI.

        break;
    }
  });


  register(null, {
    ctrl: ctrl
  });
};
