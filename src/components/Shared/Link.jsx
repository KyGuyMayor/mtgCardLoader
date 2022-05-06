import React from 'react';

const Link = (props) => (
  <p><a href={props.url} target="_blank" rel="noopener">{props.title}</a></p>
);

export default Link;