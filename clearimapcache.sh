#!/bin/sh

appname=clearimapcache

cp buildscript/makexpi.sh ./
./makexpi.sh -n $appname -o
rm ./makexpi.sh
