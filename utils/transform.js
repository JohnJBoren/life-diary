const {execFile} = require('child_process');
const {readFile, writeFile} = require('fs');
const {join} = require('path');

const EXIF = require(join(__dirname, '..', 'public', 'js', 'exif.js'));
const IMAGE = require(join(__dirname, '..', 'public', 'js', 'image.js'));

const {feature} = require('country-coder');
const mime = require('mime-types');
const sharp = require('sharp');
const cover = sharp.fit.cover;
const withoutEnlargement = true;

const {stringify, parse} = JSON;

const base64 = (type, data) => `data:${
  mime.lookup(type)
};base64,${
  Buffer.from(data).toString('base64')
}`;

const exif = file => new Promise($ => {
  execFile('exiftool', ['-j', '-g', file], (error, stdout) => {
    $(error ? null : parse(stdout)[0]);
  });
});

const preview = (source, dest, fallback) => sharp(source)
  .rotate()
  .resize({width: 256, height: 256, cover, withoutEnlargement})
  .toFile(dest)
  .then(
    () => new Promise($ => {
      readFile(dest, (err, data) => {
        $(err ? fallback : base64(source, data));
      });
    }),
    () => fallback
  );

module.exports = (folder, upload, full) => new Promise($ => {
  const image = join(folder, upload);
  const json = join(folder, '.json', upload);
  const data = {
    full,
    title: '',
    description: '',
    preview: '',
    coords: [],
    feature: null,
    metadata: null
  };
  exif(image).then(metadata => {
    data.metadata = metadata;
    if (metadata && metadata.EXIF) {
      data.title = metadata.EXIF.ImageDescription || '';
      data.description = metadata.EXIF.UserComment || '';
      data.coords = EXIF.coords(metadata.EXIF);
      if (data.coords.length)
        data.feature = feature([data.coords[1], data.coords[0]]);
    }
    (
      IMAGE.test(image) && !/\.svg$/i.test(image) ?
        preview(image, json, full) :
        Promise.resolve(full)
    ).then(preview => {
      data.preview = preview;
      writeFile(json, stringify(data), err => {
        $(err ? null : data);
      });
    });
  });
});
