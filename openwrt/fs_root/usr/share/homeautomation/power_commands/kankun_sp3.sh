#!/bin/sh

usage() {
  echo "Useage:"
  echo "  $0 <DEVICENAME> <on|off|query>"
}

if [ -z "$1" ] && [ -z "$2" ] ; then
  usage
elif [ "$2" == "on" ]; then
  echo "switching ON"
  echo 1 > /sys/class/leds/tp-link:blue:relay/brightness && echo on > /tmp/homeautomation/$1
elif [ "$2" == "off" ]; then
  echo "switching OFF"
  echo 0 > /sys/class/leds/tp-link:blue:relay/brightness && echo off > /tmp/homeautomation/$1
elif [ "$2" == "query" ]; then
  if [ $(cat /sys/class/leds/tp-link:blue:relay/brightness) == "1" ] ; then
    echo on
  else
    echo off
  fi
else
  usage
fi

