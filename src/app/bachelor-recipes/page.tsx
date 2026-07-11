import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("bachelor-recipes");

export default function Page() {
  return <CollectionView slug="bachelor-recipes" />;
}
