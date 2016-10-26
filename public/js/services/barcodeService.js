/**
 * @file
 * Handel barcode events.
 */

angular.module('BibBox').service('barcodeService', ['$q', 'proxyService',
  function ($q, proxyService) {
    'use strict';

    var currentScope = null;

    /**
     * Scanned event handler.
     *
     * Place out here to enables us to remove listener.
     *
     * @param data
     *   The data processed by the barcode scanner.
     */
    function scanned(data) {
      currentScope.$emit('barcodeScanned', data);
    }

    /**
     * Error event handler.
     *
     * Place out here to enables us to remove listener.
     *
     * @param err
     *   The error
     */
    function error(err) {
      currentScope.$emit('barcodeError', err);
    }

    /**
     * Start listing for barcode events.
     *
     * @param scope
     *   The scope to emit events into when data is received.
     */
    this.start = function start(scope) {
      currentScope = scope;
      proxyService.on('barcode.data', scanned);
      proxyService.on('barcode.err', error);

      proxyService.emit('barcode.start');
    };

    /**
     * Stop listing for barcode events.
     */
    this.stop = function stop() {
      proxyService.removeListener('barcode.data', scanned);
      proxyService.removeListener('barcode.err', error);
      currentScope = null;

      proxyService.emit('barcode.stop');
    };
  }
]);