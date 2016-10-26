/**
 * Reservations page controller.
 */
angular.module('BibBox').controller('ReservationsController', ['$scope', '$controller', '$location', '$timeout', 'userService', 'Idle', 'receiptService', '$modal',
  function ($scope, $controller, $location, $timeout, userService, Idle, receiptService, $modal) {
    'use strict';

    // Instantiate/extend base controller.
    $controller('BaseController', { $scope: $scope });

    $scope.loading = true;

    if (!userService.userLoggedIn()) {
      $location.path('/');
      return;
    }

    $scope.materials = [];

    userService.patron().then(
      function (patron) {
        $scope.loading = false;

        // Restart idle service if not running.
        Idle.watch();

        // If patron exists, get reservations.
        if (patron) {
          $scope.currentPatron = patron;

          var i;
          var item;

          // Add available items
          for (i = 0; i < patron.holdItems.length; i++) {
            item = angular.copy(patron.holdItems[i]);

            item.ready = true;

            $scope.materials.push(item);
          }

          // Add unavailable items
          for (i = 0; i < patron.unavailableHoldItems.length; i++) {
            item = angular.copy(patron.unavailableHoldItems[i]);

            item.reservationNumber = '?';
            item.ready = false;

            $scope.materials.push(item);
          }
        }
        else {
          // @TODO: Report error.
          console.error('Not patron defined');
        }
      },
      function (err) {
        $scope.loading = false;
        // @TODO: Report error.
        console.error(err);

        // Restart idle service if not running.
        Idle.watch();
      }
    );


    /**
     * Setup receipt modal.
     */
    var receiptModal = $modal({
      scope: $scope,
      templateUrl: './views/modal_receipt.html',
      show: false
    });
    $scope.showReceiptModal = function showReceiptModal() {
      receiptModal.$promise.then(receiptModal.show);
    };

    /**
     * Print receipt.
     */
    $scope.receipt = function receipt(type) {
      var credentials = userService.getCredentials();

      receiptService.reservations(credentials.username, credentials.password, type).then(
        function (status) {
          alert('mail sent');

          // @TODO: Redirect to front page.
        },
        function (err) {
          // @TODO: handel error etc.
          alert(err);
        }
      );
    };

    /**
     * Goto to front page.
     */
    $scope.gotoFront = function gotoFront() {
      userService.logout();
      $location.path('/');
    };

    /**
     * On destroy.
     *
     * Log out of user service.
     */
    $scope.$on('$destroy', function () {
      userService.logout();
      receiptModal.hide();
    });
  }
]);
