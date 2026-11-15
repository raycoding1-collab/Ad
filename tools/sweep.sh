#!/bin/sh
# The full sweep, from the rendered video itself.
#   sh tools/sweep.sh VIDEO              -> shots/sweep_A.jpg, sweep_B.jpg: a frame every second (0.5, 1.5, ...)
#   sh tools/sweep.sh VIDEO strip T NAME -> shots/strip_NAME.jpg: 8 frames 0.1 s apart from T (motion check)
V=$1
if [ "$2" = "strip" ]; then
  ffmpeg -y -loglevel error -i "$V" -ss "$3" -t 0.8 -vf "select='not(mod(n\,3))',scale=270:-1,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.5,tile=8x1" -fps_mode vfr -update 1 "shots/strip_$4.jpg"
  echo "shots/strip_$4.jpg"; exit
fi
ffmpeg -y -loglevel error -ss 0.5 -i "$V" -t 13 -vf "fps=1,scale=300:-1,drawtext=text='%{eif\:t+0.5\:d}.5':x=4:y=4:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5,tile=7x2" -frames:v 1 shots/sweep_A.jpg
ffmpeg -y -loglevel error -ss 13.5 -i "$V" -t 13 -vf "fps=1,scale=300:-1,drawtext=text='%{eif\:t+13.5\:d}.5':x=4:y=4:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5,tile=6x2" -frames:v 1 shots/sweep_B.jpg
echo shots/sweep_A.jpg shots/sweep_B.jpg
