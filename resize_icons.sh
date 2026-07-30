#!/bin/bash
set -e
SRC="assets/logo_transparent.png"

mkdir -p apps/landing/public
magick $SRC -resize 16x16 apps/landing/public/favicon-16x16.png
magick $SRC -resize 32x32 apps/landing/public/favicon-32x32.png
magick $SRC -resize 32x32 apps/landing/public/favicon.ico
magick $SRC -resize 180x180 apps/landing/public/apple-touch-icon.png
magick $SRC -resize 192x192 apps/landing/public/android-chrome-192x192.png
magick $SRC -resize 512x512 apps/landing/public/android-chrome-512x512.png

mkdir -p apps/mobile/public/icons
for size in 48 72 96 128 192 256 512; do
  magick $SRC -resize ${size}x${size} apps/mobile/public/icons/icon-${size}.webp
done
magick $SRC -resize 32x32 apps/mobile/public/favicon.ico

mkdir -p apps/mobile/assets
cp $SRC apps/mobile/assets/icon.png
# Splash with transparent logo on dark background
magick -size 2732x2732 xc:"#121212" $SRC -geometry +0+0 -gravity center -composite apps/mobile/assets/splash.png
