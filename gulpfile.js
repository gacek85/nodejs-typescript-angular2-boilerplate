let gulp = require('gulp'),
    ts = require('gulp-typescript'),
    insert = require('gulp-insert'),
    gulpFilter = require('gulp-filter'),
    babel = require("gulp-babel"),
    tslint = require('gulp-tslint'),
    sourcemaps = require('gulp-sourcemaps'),
    runSequence = require('run-sequence'),
    sys = require('sys'),
    fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    newer = require('gulp-newer'),
    changed = require('gulp-changed'),
    print = require('gulp-print'),
    gulpif = require('gulp-if'),
    ext_replace = require('gulp-ext-replace'),
    addsrc = require('gulp-add-src'),
    mocha = require('gulp-mocha'),
    addTypingsOnAppCompile = false,

    config = {
        dirs: {
            src: './src/**/*.ts',
            dst: './dist/application/node_modules',
            typings: './typings/index.d.ts',
            customTypings: './typings/custom.d.ts'
        },
        tsExternalModules: ['angular2', 'rxjs']
    },

    tsProject = ts.createProject(
        './src/tsconfig.json',
        {
            typescript: require('typescript')
        }
    )
;

gulp.task('test', function () {
    return runSequence('mocha-tests');
});

gulp.task('mocha-tests', function() {
    return gulp.src('dist/test/**/*.js', {
        read: false
    })
    .pipe(mocha({ 
        reporter : 'progress' 
    }))
    .pipe(gulp.dest('coverage'));
    
});

gulp.task('watch-app',function() {
    gulp.watch(config.dirs.src, ['watcher-task']);
});

gulp.task('watcher-task', function() {
    return runSequence(
        'create-symlinks', 
        'real-compile-app-check-changes', 
        'real-compile-app', 
        'real-move-app-definitions', 
        'restart-app', 
        'remove-symlinks',
        'test'
    );
});

gulp.task('compile-app', function() {
    return runSequence(
        'create-symlinks', 
        'real-compile-app-check-changes', 
        'real-compile-app', 
        'real-move-app-definitions', 
        'remove-symlinks'
    );
});

gulp.task('real-compile-app-check-changes', function () {
    if (!fs.existsSync(config.dirs.dst)){
        fs.mkdirSync(config.dirs.dst);
    }
    
    return gulp.src([config.dirs.src, config.dirs.typings], {base: './src'})
        .pipe(newer({dest: config.dirs.dst, ext: '.js'}))
        .pipe(gulpif(function(file){
            if (file.path.indexOf(config.dirs.typings.replace('./', '')) > 0) {
                console.log('If typings changed, please change something in ./src code in order to recompile.');
            } else{
                addTypingsOnAppCompile = true;
            }
        }, print()));
});

gulp.task('real-compile-app', function () {
    let jsfilter = gulpFilter('**/*.js');

    if (!fs.existsSync(config.dirs.dst)){
        fs.mkdirSync(config.dirs.dst);
    }

    return gulp.src([config.dirs.src], {base: './src'})
        .pipe(newer({dest: config.dirs.dst, ext: '.js'}))
        .pipe(gulpif(addTypingsOnAppCompile, addsrc(config.dirs.typings)), print())
        .pipe(print())
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject))
        .pipe(jsfilter)
        .pipe(insert.prepend('"use strict";require(\'source-map-support\').install();'))
        .pipe(jsfilter.restore())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(config.dirs.dst));
});

gulp.task('restart-app', function() {
    exec('docker exec nodejstypescriptangular2boilerplate_app_1 "./code/bin/restart.sh"', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
    });
});

/**
 * Moving app definitions used to prevent unnessessary recompilation
 */
gulp.task('real-move-app-definitions', function() {
    let dtsfilter = gulpFilter('**/*.d.ts');

    if (!fs.existsSync(config.dirs.dst)){
        fs.mkdirSync(config.dirs.dst);
    }

    return tsProject.src()
        .pipe(dtsfilter)
        .pipe(ext_replace('.js'))
        .pipe(gulp.dest(config.dirs.dst));
});

function unique(array){
    return array.filter(function(el, index, arr) {
        return index == arr.indexOf(el);
    });
}


/**
 * Symlinks used to link to libraries from node_modules
 */
gulp.task('create-symlinks', function() {
    let TsExternalModules = config.tsExternalModules;
    for(let i = 0; i < TsExternalModules.length; i++) {
        let module = TsExternalModules[i],
            real_dir = __dirname + '/node_modules/' + module,
            link_dir = __dirname + '/src/' + module
        ;

        if (fs.existsSync(link_dir)) {
            fs.unlinkSync(link_dir);
        }

        fs.symlinkSync(real_dir, link_dir);
    }
});
gulp.task('remove-symlinks', function() {
    let TsExternalModules = config.tsExternalModules;
    for(let i = 0; i < TsExternalModules.length; i++) {
        let module = TsExternalModules[i],
            link_dir = __dirname + '/src/' + module
        ;
        try{fs.unlinkSync(link_dir);}catch(e){}
    }
});