import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("chicken-recipes");

export default function Page() {
  return <CollectionView slug="chicken-recipes" />;
}
