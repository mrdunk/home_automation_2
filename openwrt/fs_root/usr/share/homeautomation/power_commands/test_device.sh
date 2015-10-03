#!/bin/sh

usage() {
  echo "Useage:"
  echo "  $0 <DEVICE_LABEL> <on|off|query>"
}

if [ -z "$1" ] && [ -z "$2" ] ; then
  usage
elif [ "$2" == "on" ]; then
  echo "switching ON"
  echo on > /tmp/homeautomation/$1
elif [ "$2" == "off" ]; then
  echo "switching OFF"
  echo off > /tmp/homeautomation/$1
elif [ "$2" == "query" ]; then
  cat /tmp/homeautomation/$1 2> /dev/null || echo off
else
  usage
fi

