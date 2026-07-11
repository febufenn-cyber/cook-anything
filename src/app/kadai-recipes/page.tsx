import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("kadai-recipes");

export default function Page() {
  return <CollectionView slug="kadai-recipes" />;
}
