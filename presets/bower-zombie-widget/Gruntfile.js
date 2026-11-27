module.exports = function (grunt) {
  grunt.initConfig({
    jshint: { all: ['src/*.js'], options: { jshintrc: true } },
    qunit: { all: ['test/index.html'] },
    uglify: {
      dist: {
        files: { 'dist/jquery.zombie.min.js': ['src/jquery.zombie.js'] }
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('test', ['jshint', 'qunit']);
  grunt.registerTask('default', ['test', 'uglify']);
};
