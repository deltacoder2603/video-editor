import React from 'react';
import ReactPlayer from 'react-player';
import type { ReactPlayerProps } from 'react-player';

interface ReactVideoPlayerProps extends ReactPlayerProps {
  poster?: string;
}

const ReactVideoPlayer: React.FC<ReactVideoPlayerProps> = ({
  poster,
  ...props
}) => {
  return (
      <ReactPlayer
        {...(poster ? { light: poster } : {})}
      {...props}
      />
  );
};

export default ReactVideoPlayer; 