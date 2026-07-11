import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("egg-recipes");

export default function Page() {
  return <CollectionView slug="egg-recipes" />;
}
