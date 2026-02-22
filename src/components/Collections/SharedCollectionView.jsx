import React from 'react';
import { useParams } from 'react-router-dom';
import CollectionDetail from './CollectionDetail';

const SharedCollectionView = () => {
  const { slug } = useParams();
  return <CollectionDetail shareSlug={slug} readOnly />;
};

export default SharedCollectionView;
