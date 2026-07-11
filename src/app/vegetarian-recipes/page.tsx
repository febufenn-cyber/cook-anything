import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("vegetarian-recipes");

export default function Page() {
  return <CollectionView slug="vegetarian-recipes" />;
}
