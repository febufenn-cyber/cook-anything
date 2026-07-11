import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("indian-recipes");

export default function Page() {
  return <CollectionView slug="indian-recipes" />;
}
