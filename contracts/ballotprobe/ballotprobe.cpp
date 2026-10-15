#include "quick_ballot_proof.hpp"
using namespace eosio;
using verifier = daclify::quick_ballot_proof;
// Disposable qualification only; this contract never accepts or counts votes.
CONTRACT ballotprobe : public contract {
  void authorize() const { require_auth(get_self()); check(action_data_size() <= 512, "BLS_ACTION_SIZE"); }
public:
  using contract::contract;
  ACTION g1add(std::vector<char> left, std::vector<char> right, std::vector<char> expected) {
    authorize();const auto a=verifier::read_point(left),b=verifier::read_point(right),want=verifier::read_point(expected);bls_g1 result{};
    check(bls_g1_add(a,b,result)==0,"BLS_POINT");check(result==want,"BLS_RESULT");
  }
  ACTION g1mul(std::vector<char> point, std::vector<char> scalar, std::vector<char> expected) {
    authorize();const auto p=verifier::read_point(point),want=verifier::read_point(expected);const auto s=verifier::read_scalar(scalar);bls_g1 result{};
    check(bls_g1_weighted_sum(&p,&s,1,result)==0,"BLS_POINT");check(result==want,"BLS_RESULT");
  }
  ACTION g1check(std::vector<char> point,bool subgroup) {
    authorize();const auto p=verifier::read_point(point);bls_g1 zero{},result{};check(bls_g1_add(p,zero,result)==0,"BLS_POINT");
    if(subgroup){const auto q=verifier::group_order();check(bls_g1_weighted_sum(&p,&q,1,result)==0&&result==zero,"BLS_SUBGROUP");}
  }
  ACTION validkey(std::vector<char> context,std::vector<char> key,std::vector<char> proof) { authorize();verifier::validkey(context,key,proof); }
  ACTION validvote(std::vector<char> context,std::vector<char> key,std::vector<char> ciphertext,std::vector<char> proof) { authorize();verifier::validvote(context,key,ciphertext,proof); }
  ACTION validtally(std::vector<char> context,std::vector<char> key,std::vector<char> ciphertext,uint64_t count,uint64_t up,std::vector<char> proof) { authorize();verifier::validtally(context,key,ciphertext,count,up,proof); }
};
EOSIO_DISPATCH(ballotprobe,(g1add)(g1mul)(g1check)(validkey)(validvote)(validtally))
