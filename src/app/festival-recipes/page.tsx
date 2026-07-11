import CollectionView, { collectionMetadata } from "@/components/CollectionView";

export const generateMetadata = () => collectionMetadata("festival-recipes");

export default function Page() {
  return <CollectionView slug="festival-recipes" />;
}
