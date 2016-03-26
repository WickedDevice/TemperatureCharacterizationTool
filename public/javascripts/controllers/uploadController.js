angular.module('MyApp', ['ngFileUpload'])
.controller('UploadCtrl', ['$scope', 'Upload', '$timeout', function ($scope, Upload, $timeout) {
    $scope.uploadFiles = function (files) {
        $scope.files = files;
        if (files && files.length) {
            Upload.upload({
                url: '/upload',
                method: 'POST',
                data: {
                    files: files
                }
            }).then(function (response) {
                $timeout(function () {
                    $scope.result = response.data;
                });
            }, function (response) {
                if (response.status > 0) {
                    $scope.errorMsg = response.status + ': ' + response.data;
                }
                $scope.progress = -1; // clear the progress bar
            }, function (evt) {
                $scope.progress =
                    Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
            });
        }
    };
}]);