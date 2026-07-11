import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("south-indian-recipes");

export default function Page() {
  return <CollectionView slug="south-indian-recipes" />;
}
